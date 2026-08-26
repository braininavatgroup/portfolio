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
let update: [CFString: Any] = [
    kSecAttrAccess: access,
    kSecAttrLabel: label,
    kSecValueData: secret,
]

var item = query
for (attribute, value) in update {
    item[attribute] = value
}
status = SecItemAdd(item as CFDictionary, nil)

guard status == errSecSuccess else {
    fail("Keychain write failed with status \(status).")
}
