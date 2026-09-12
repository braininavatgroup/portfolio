import Foundation
import Security

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data("\(message)\n".utf8))
    exit(1)
}

guard CommandLine.arguments.count == 4 else {
    fail("Expected service, account, and label arguments.")
}

let service = CommandLine.arguments[1]
let account = CommandLine.arguments[2]
let label = CommandLine.arguments[3]
let secret = FileHandle.standardInput.readDataToEndOfFile()

guard !secret.isEmpty else {
    fail("Refusing to store an empty Keychain secret.")
}

// A caller with nobody in front of the screen sets BIV_KEYCHAIN_NO_INTERACTION
// so that a Keychain operation the item's access controls do not allow fails
// with a status code instead of raising a dialog no one is there to answer.
// `setup:insights` leaves it unset: a person is running it and can respond.
if ProcessInfo.processInfo.environment["BIV_KEYCHAIN_NO_INTERACTION"] == "1" {
    let interaction = SecKeychainSetUserInteractionAllowed(false)
    guard interaction == errSecSuccess else {
        fail("Could not disable Keychain prompts (status \(interaction)).")
    }
}

var trustedReader: SecTrustedApplication?
var status = SecTrustedApplicationCreateFromPath(
    "/usr/bin/security",
    &trustedReader
)
guard status == errSecSuccess, let trustedReader else {
    fail("Could not authorize the system Keychain reader (status \(status)).")
}

var access: SecAccess?
status = SecAccessCreate(
    label as CFString,
    [trustedReader] as CFArray,
    &access
)
guard status == errSecSuccess, let access else {
    fail("Could not create Keychain access controls (status \(status)).")
}

let query: [CFString: Any] = [
    kSecClass: kSecClassGenericPassword,
    kSecAttrService: service,
    kSecAttrAccount: account,
]
let creation: [CFString: Any] = [
    kSecAttrAccess: access,
    kSecAttrLabel: label,
    kSecValueData: secret,
]

var item = query
for (attribute, value) in creation {
    item[attribute] = value
}
status = SecItemAdd(item as CFDictionary, nil)

if status == errSecDuplicateItem {
    // Rotation, for a caller that did not remove the old item itself. The
    // setup scripts do remove it — with /usr/bin/security, the one program the
    // item's access controls name — so that this writer always takes the
    // create path above and never has to ask macOS for an authorization it
    // does not hold, which it would ask for with a password dialog.
    //
    // Reaching here means an item exists that the caller could not delete, so
    // update it in place. The update carries no kSecAttrAccess, leaving the
    // item's existing access controls alone. This succeeds only where those
    // controls already permit it; where they do not, macOS may prompt, which
    // is why the scripts do not rely on this path.
    let rotation: [CFString: Any] = [
        kSecAttrLabel: label,
        kSecValueData: secret,
    ]
    status = SecItemUpdate(query as CFDictionary, rotation as CFDictionary)
    guard status == errSecSuccess else {
        fail("Keychain rotation failed with status \(status).")
    }
} else {
    guard status == errSecSuccess else {
        fail("Keychain write failed with status \(status).")
    }
}
