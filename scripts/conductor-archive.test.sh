#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
archive_hook="$repo_root/scripts/conductor-archive.sh"
fixture_root="$(mktemp -d "${TMPDIR:-/tmp}/conductor-archive-test.XXXXXX")"

cleanup() {
  chmod -R u+w "$fixture_root" 2>/dev/null || true
  rm -rf "$fixture_root"
}
trap cleanup EXIT

init_repo() {
  local repo="$1"
  git init -q -b main "$repo"
  git -C "$repo" config user.name "Conductor archive fixture"
  git -C "$repo" config user.email "fixture@example.invalid"
  git -C "$repo" commit -q --allow-empty -m "fixture"
}

registration_count() {
  git -C "$1" worktree list --porcelain | grep -c '^worktree '
}

prunable_count() {
  git -C "$1" worktree list --porcelain | grep -c '^prunable ' || true
}

test_recursive_worktrees() {
  local case_root="$fixture_root/recursive"
  local workspace="$case_root/workspace"
  local outer_parent="$case_root/outer-parent"
  local inner_parent="$case_root/inner-parent"
  local outer_worktree="$workspace/.context/outer-agent-worktree"
  local inner_worktree="$outer_worktree/nested-inner-agent-worktree"
  local fake_bin="$case_root/bin"

  for repo in "$workspace" "$outer_parent" "$inner_parent"; do
    init_repo "$repo"
  done

  mkdir -p "$workspace/.context" "$fake_bin"
  git -C "$outer_parent" worktree add -q -b outer "$outer_worktree"
  git -C "$inner_parent" worktree add -q -b inner "$inner_worktree"
  test "$(registration_count "$outer_parent")" -eq 2
  test "$(registration_count "$inner_parent")" -eq 2

  # Sibling enumeration order is unspecified. Supply the valid outer-first
  # order; the production hook must independently sort children before parents.
  cat > "$fake_bin/find" <<'FIND'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == ".context" ]]; then
  for argument in "$@"; do
    if [[ "$argument" == "-print0" ]]; then
      printf '%s\0%s\0' "$FIND_OUTER_WORKTREE/.git" "$FIND_INNER_WORKTREE/.git"
      exit 0
    fi
  done
  printf '%s\n%s\n' "$FIND_OUTER_WORKTREE" "$FIND_INNER_WORKTREE"
  exit 0
fi

exec /usr/bin/find "$@"
FIND
  chmod +x "$fake_bin/find"

  (
    cd "$workspace"
    PATH="$fake_bin:$PATH" \
      FIND_OUTER_WORKTREE="$outer_worktree" \
      FIND_INNER_WORKTREE="$inner_worktree" \
      bash "$archive_hook"
  )

  for repo in "$outer_parent" "$inner_parent"; do
    test "$(registration_count "$repo")" -eq 1
    test "$(prunable_count "$repo")" -eq 0
  done
  test ! -e "$outer_worktree"
  test ! -e "$inner_worktree"
}

test_dirty_worktree() {
  local case_root="$fixture_root/dirty"
  local workspace="$case_root/workspace"
  local parent_repo="$case_root/parent"
  local worktree="$workspace/.context/dirty-agent-worktree"
  local output

  init_repo "$workspace"
  init_repo "$parent_repo"
  mkdir -p "$workspace/.context"
  git -C "$parent_repo" worktree add -q -b dirty "$worktree"
  printf 'keep me\n' > "$worktree/untracked-user-note.txt"

  if output="$(cd "$workspace" && bash "$archive_hook" 2>&1)"; then
    echo "expected dirty worktree archive to fail" >&2
    return 1
  fi

  [[ "$output" == *"refusing to archive dirty worktree"* ]]
  test -f "$worktree/untracked-user-note.txt"
  test "$(registration_count "$parent_repo")" -eq 2
  test "$(prunable_count "$parent_repo")" -eq 0
}

test_locked_worktree() {
  local case_root="$fixture_root/locked"
  local workspace="$case_root/workspace"
  local parent_repo="$case_root/parent"
  local worktree="$workspace/.context/locked-agent-worktree"

  init_repo "$workspace"
  init_repo "$parent_repo"
  mkdir -p "$workspace/.context"
  git -C "$parent_repo" worktree add -q -b locked "$worktree"
  git -C "$parent_repo" worktree lock --reason fixture "$worktree"

  (cd "$workspace" && bash "$archive_hook")

  test ! -e "$worktree"
  test "$(registration_count "$parent_repo")" -eq 1
  test "$(prunable_count "$parent_repo")" -eq 0
}

test_initialized_submodule() {
  local case_root="$fixture_root/submodule"
  local workspace="$case_root/workspace"
  local parent_repo="$case_root/parent"
  local submodule_repo="$case_root/submodule-source"
  local worktree="$workspace/.context/submodule-agent-worktree"

  for repo in "$workspace" "$parent_repo" "$submodule_repo"; do
    init_repo "$repo"
  done

  git -c protocol.file.allow=always -C "$parent_repo" \
    submodule add -q "$submodule_repo" modules/example
  git -C "$parent_repo" commit -q -am "add fixture submodule"
  mkdir -p "$workspace/.context"
  git -C "$parent_repo" worktree add -q -b submodule "$worktree"
  git -c protocol.file.allow=always -C "$worktree" submodule update --init -q
  test -f "$worktree/modules/example/.git"

  (cd "$workspace" && bash "$archive_hook")

  test ! -e "$worktree"
  test "$(registration_count "$parent_repo")" -eq 1
  test "$(prunable_count "$parent_repo")" -eq 0
}

test_missing_worktree() {
  local case_root="$fixture_root/missing"
  local workspace="$case_root/workspace"
  local worktree="$workspace/.context/missing-agent-worktree"

  init_repo "$workspace"
  mkdir -p "$workspace/.context"
  git -C "$workspace" worktree add -q -b missing "$worktree"
  test "$(registration_count "$workspace")" -eq 2
  find "$worktree" -depth -delete
  test "$(prunable_count "$workspace")" -eq 1

  (cd "$workspace" && bash "$archive_hook")

  test "$(registration_count "$workspace")" -eq 1
  test "$(prunable_count "$workspace")" -eq 0
}

test_ignored_file() {
  local case_root="$fixture_root/ignored"
  local workspace="$case_root/workspace"
  local parent_repo="$case_root/parent"
  local worktree="$workspace/.context/ignored-agent-worktree"
  local output

  init_repo "$workspace"
  init_repo "$parent_repo"
  printf '.env\n' > "$parent_repo/.gitignore"
  git -C "$parent_repo" add .gitignore
  git -C "$parent_repo" commit -q -m "ignore fixture secret"
  mkdir -p "$workspace/.context"
  git -C "$parent_repo" worktree add -q -b ignored "$worktree"
  printf 'keep me\n' > "$worktree/.env"

  if output="$(cd "$workspace" && bash "$archive_hook" 2>&1)"; then
    echo "expected ignored-file archive to fail" >&2
    return 1
  fi

  [[ "$output" == *"refusing to archive dirty worktree"* ]]
  test -f "$worktree/.env"
  test "$(registration_count "$parent_repo")" -eq 2
  test "$(prunable_count "$parent_repo")" -eq 0
}

test_validate_before_removal() {
  local case_root="$fixture_root/validate-first"
  local workspace="$case_root/workspace"
  local parent_repo="$case_root/parent"
  local clean_worktree="$workspace/.context/z-clean-agent-worktree"
  local dirty_worktree="$workspace/.context/a-dirty-agent-worktree"
  local output

  init_repo "$workspace"
  init_repo "$parent_repo"
  mkdir -p "$workspace/.context"
  git -C "$parent_repo" worktree add -q -b clean "$clean_worktree"
  git -C "$parent_repo" worktree add -q -b dirty-sibling "$dirty_worktree"
  printf 'keep me\n' > "$dirty_worktree/untracked-user-note.txt"

  if output="$(cd "$workspace" && bash "$archive_hook" 2>&1)"; then
    echo "expected mixed-worktree archive to fail" >&2
    return 1
  fi

  [[ "$output" == *"refusing to archive dirty worktree"* ]]
  test -d "$clean_worktree"
  test -f "$dirty_worktree/untracked-user-note.txt"
  test "$(registration_count "$parent_repo")" -eq 3
  test "$(prunable_count "$parent_repo")" -eq 0
}

test_discovery_failure() {
  local case_root="$fixture_root/discovery-failure"
  local workspace="$case_root/workspace"
  local parent_repo="$case_root/parent"
  local worktree="$workspace/.context/discovery-agent-worktree"
  local fake_bin="$case_root/bin"
  local output

  init_repo "$workspace"
  init_repo "$parent_repo"
  mkdir -p "$workspace/.context" "$fake_bin"
  git -C "$parent_repo" worktree add -q -b discovery "$worktree"

  cat > "$fake_bin/find" <<'FIND'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == ".context" ]]; then
  printf '%s\0' "$FIND_WORKTREE/.git"
  exit 1
fi

exec /usr/bin/find "$@"
FIND
  chmod +x "$fake_bin/find"

  if output="$(
    cd "$workspace" &&
      PATH="$fake_bin:$PATH" FIND_WORKTREE="$worktree" bash "$archive_hook" 2>&1
  )"; then
    echo "expected discovery failure to abort archive" >&2
    return 1
  fi

  [[ "$output" == *"failed to inventory nested worktrees"* ]]
  test -d "$worktree"
  test "$(registration_count "$parent_repo")" -eq 2
  test "$(prunable_count "$parent_repo")" -eq 0
}

test_unreachable_detached_head() {
  local case_root="$fixture_root/detached"
  local workspace="$case_root/workspace"
  local parent_repo="$case_root/parent"
  local worktree="$workspace/.context/detached-agent-worktree"
  local output

  init_repo "$workspace"
  init_repo "$parent_repo"
  mkdir -p "$workspace/.context"
  git -C "$parent_repo" worktree add -q --detach "$worktree"
  git -C "$worktree" commit -q --allow-empty -m "orphaned fixture commit"

  if output="$(cd "$workspace" && bash "$archive_hook" 2>&1)"; then
    echo "expected unreachable detached HEAD archive to fail" >&2
    return 1
  fi

  [[ "$output" == *"refusing to archive unreachable detached HEAD"* ]]
  test -d "$worktree"
  test "$(registration_count "$parent_repo")" -eq 2
  test "$(prunable_count "$parent_repo")" -eq 0
}

test_local_only_detached_ref() {
  local case_root="$fixture_root/local-detached"
  local workspace="$case_root/workspace"
  local parent_repo="$case_root/parent"
  local worktree="$workspace/.context/local-detached-agent-worktree"
  local head_oid
  local output

  init_repo "$workspace"
  init_repo "$parent_repo"
  mkdir -p "$workspace/.context"
  git -C "$parent_repo" worktree add -q --detach "$worktree"
  git -C "$worktree" commit -q --allow-empty -m "local-only detached fixture"
  head_oid="$(git -C "$worktree" rev-parse HEAD)"
  git -C "$parent_repo" tag local-only "$head_oid"
  test -z "$(git -C "$parent_repo" for-each-ref --format='%(refname)' refs/remotes/origin)"

  if output="$(cd "$workspace" && bash "$archive_hook" 2>&1)"; then
    echo "expected local-only detached ref archive to fail" >&2
    return 1
  fi

  [[ "$output" == *"refusing to archive detached HEAD without origin reachability"* ]]
  test -d "$worktree"
  test "$(registration_count "$parent_repo")" -eq 2
  test "$(prunable_count "$parent_repo")" -eq 0
}

test_missing_unreachable_detached_head() {
  local case_root="$fixture_root/missing-detached"
  local workspace="$case_root/workspace"
  local worktree="$workspace/.context/missing-detached-agent-worktree"
  local output

  init_repo "$workspace"
  mkdir -p "$workspace/.context"
  git -C "$workspace" worktree add -q --detach "$worktree"
  git -C "$worktree" commit -q --allow-empty -m "missing orphaned fixture commit"
  find "$worktree" -depth -delete

  if output="$(cd "$workspace" && bash "$archive_hook" 2>&1)"; then
    echo "expected missing unreachable detached HEAD archive to fail" >&2
    return 1
  fi

  [[ "$output" == *"refusing to archive missing unreachable detached HEAD"* ]]
  test "$(registration_count "$workspace")" -eq 2
  test "$(prunable_count "$workspace")" -eq 1
}

test_missing_local_only_detached_ref() {
  local case_root="$fixture_root/missing-local-detached"
  local workspace="$case_root/workspace"
  local worktree="$workspace/.context/missing-local-detached-agent-worktree"
  local head_oid
  local output

  init_repo "$workspace"
  mkdir -p "$workspace/.context"
  git -C "$workspace" worktree add -q --detach "$worktree"
  git -C "$worktree" commit -q --allow-empty -m "missing local-only detached fixture"
  head_oid="$(git -C "$worktree" rev-parse HEAD)"
  git -C "$workspace" tag missing-local-only "$head_oid"
  /usr/bin/find "$worktree" -depth -delete

  if output="$(cd "$workspace" && bash "$archive_hook" 2>&1)"; then
    echo "expected missing local-only detached ref archive to fail" >&2
    return 1
  fi

  [[ "$output" == *"refusing to archive missing detached HEAD without origin reachability"* ]]
  test "$(registration_count "$workspace")" -eq 2
  test "$(prunable_count "$workspace")" -eq 1
}

test_literal_nested_pathspec() {
  local case_root="$fixture_root/literal-pathspec"
  local workspace="$case_root/workspace"
  local outer_parent="$case_root/outer-parent"
  local inner_parent="$case_root/inner-parent"
  local outer_worktree="$workspace/.context/outer-agent-worktree"
  local inner_worktree="$outer_worktree/*"
  local output

  for repo in "$workspace" "$outer_parent" "$inner_parent"; do
    init_repo "$repo"
  done

  mkdir -p "$workspace/.context"
  git -C "$outer_parent" worktree add -q -b outer "$outer_worktree"
  git -C "$inner_parent" worktree add -q -b inner "$inner_worktree"
  printf 'keep me\n' > "$outer_worktree/user-note.txt"

  if output="$(cd "$workspace" && bash "$archive_hook" 2>&1)"; then
    echo "expected literal-pathspec archive to fail" >&2
    return 1
  fi

  [[ "$output" == *"refusing to archive dirty worktree"* ]]
  test -f "$outer_worktree/user-note.txt"
  test -d "$inner_worktree"
  test "$(registration_count "$outer_parent")" -eq 2
  test "$(registration_count "$inner_parent")" -eq 2
}

test_present_unvalidated_registration() {
  local case_root="$fixture_root/present-unvalidated"
  local workspace="$case_root/workspace"
  local worktree="$workspace/.context/unvalidated-agent-worktree"
  local output

  init_repo "$workspace"
  mkdir -p "$workspace/.context"
  git -C "$workspace" worktree add -q -b unvalidated "$worktree"
  printf 'keep me\n' > "$worktree/untracked-user-note.txt"
  /usr/bin/find "$worktree/.git" -delete

  if output="$(cd "$workspace" && bash "$archive_hook" 2>&1)"; then
    echo "expected present unvalidated registration to abort archive" >&2
    return 1
  fi

  [[ "$output" == *"refusing to archive present unvalidated worktree"* ]]
  test -f "$worktree/untracked-user-note.txt"
  test "$(registration_count "$workspace")" -eq 2
}

test_external_parent_missing_registration() {
  local case_root="$fixture_root/external-missing"
  local workspace="$case_root/workspace"
  local parent_repo="$case_root/parent"
  local surviving_worktree="$workspace/.context/surviving-agent-worktree"
  local missing_worktree="$workspace/.context/missing-agent-worktree"

  init_repo "$workspace"
  init_repo "$parent_repo"
  mkdir -p "$workspace/.context"
  git -C "$parent_repo" worktree add -q -b surviving "$surviving_worktree"
  git -C "$parent_repo" worktree add -q -b missing-sibling "$missing_worktree"
  /usr/bin/find "$missing_worktree" -depth -delete
  test "$(registration_count "$parent_repo")" -eq 3
  test "$(prunable_count "$parent_repo")" -eq 1

  (cd "$workspace" && bash "$archive_hook")

  test ! -e "$surviving_worktree"
  test ! -e "$missing_worktree"
  test "$(registration_count "$parent_repo")" -eq 1
  test "$(prunable_count "$parent_repo")" -eq 0
}

case "${1:-all}" in
  recursive) test_recursive_worktrees ;;
  dirty) test_dirty_worktree ;;
  locked) test_locked_worktree ;;
  submodule) test_initialized_submodule ;;
  missing) test_missing_worktree ;;
  ignored) test_ignored_file ;;
  validate-first) test_validate_before_removal ;;
  discovery-failure) test_discovery_failure ;;
  detached) test_unreachable_detached_head ;;
  local-detached) test_local_only_detached_ref ;;
  missing-detached) test_missing_unreachable_detached_head ;;
  missing-local-detached) test_missing_local_only_detached_ref ;;
  literal-pathspec) test_literal_nested_pathspec ;;
  present-unvalidated) test_present_unvalidated_registration ;;
  external-missing) test_external_parent_missing_registration ;;
  all)
    test_recursive_worktrees
    test_dirty_worktree
    test_locked_worktree
    test_initialized_submodule
    test_missing_worktree
    test_ignored_file
    test_validate_before_removal
    test_discovery_failure
    test_unreachable_detached_head
    test_local_only_detached_ref
    test_missing_unreachable_detached_head
    test_missing_local_only_detached_ref
    test_literal_nested_pathspec
    test_present_unvalidated_registration
    test_external_parent_missing_registration
    ;;
  *)
    echo "usage: $0 [recursive|dirty|locked|submodule|missing|ignored|validate-first|discovery-failure|detached|local-detached|missing-detached|missing-local-detached|literal-pathspec|present-unvalidated|external-missing|all]" >&2
    exit 64
    ;;
esac
