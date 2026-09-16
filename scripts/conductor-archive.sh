#!/usr/bin/env bash
set -euo pipefail

for dependency_dir in \
  node_modules; do
  if [[ -d "$dependency_dir" ]]; then
    find "$dependency_dir" -depth -delete
  fi
done

# Agents create nested worktrees under .context/. Conductor archives .context
# wholesale, so without this those checkouts survive the workspace that owned
# them. Deregister each from its parent repo before deleting the directory, so
# the parent is not left with a registration pointing at a path we removed —
# that is what turns a worktree into an unrecoverable orphan with no reachable
# object store. BIV-348: this repo had no archive hook at all, so its archives
# alone accumulated 20 GB of dead node_modules; the pattern below matches the
# hardened hook already proven in Consulting, Music Promo and Dubs (BIV-279).
if [[ -d .context ]]; then
  context_root="$(cd .context && pwd -P)"
  inventory_dir="$(mktemp -d "${TMPDIR:-/tmp}/conductor-archive.XXXXXX")"
  discovered_worktrees="$inventory_dir/discovered"
  validated_worktrees="$inventory_dir/validated"
  repository_registrations="$inventory_dir/registrations"
  missing_worktrees="$inventory_dir/missing"

  cleanup_inventory() {
    rm -f -- \
      "$discovered_worktrees" \
      "$validated_worktrees" \
      "$repository_registrations" \
      "$missing_worktrees"
    rmdir "$inventory_dir" 2>/dev/null || true
  }
  trap cleanup_inventory EXIT

  if ! find .context -type f -name .git -print0 |
    while IFS= read -r -d '' git_file; do
      printf '%s\0' "${git_file%/.git}"
    done |
    LC_ALL=C sort -zr > "$discovered_worktrees"; then
    echo "failed to inventory nested worktrees" >&2
    exit 1
  fi

  if ! workspace_common_dir="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)"; then
    echo "refusing to archive because workspace Git metadata cannot be read" >&2
    exit 1
  fi

  checked_roots=()
  linked_roots=()
  parent_common_dirs=("$workspace_common_dir")
  while IFS= read -r -d '' worktree; do
    if ! worktree_root="$(git -C "$worktree" rev-parse --show-toplevel 2>/dev/null)"; then
      echo "refusing to archive unreadable worktree: $worktree" >&2
      exit 1
    fi
    if ! git_dir="$(git -C "$worktree_root" rev-parse --path-format=absolute --git-dir 2>/dev/null)"; then
      echo "refusing to archive worktree with unreadable Git metadata: $worktree_root" >&2
      exit 1
    fi
    if ! common_dir="$(git -C "$worktree_root" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)"; then
      echo "refusing to archive worktree with no parent repository: $worktree_root" >&2
      exit 1
    fi
    status_args=(status --porcelain --untracked-files=all --ignored=matching -- .)
    for ((index = 0; index < ${#checked_roots[@]}; index++)); do
      checked_root="${checked_roots[$index]}"
      if [[ "$checked_root" == "$worktree_root/"* ]]; then
        relative_root="${checked_root#"$worktree_root/"}"
        status_args+=(":(top,literal,exclude)$relative_root")
      fi
    done
    if ! status="$(git -C "$worktree_root" "${status_args[@]}" 2>/dev/null)"; then
      echo "refusing to archive worktree whose status cannot be read: $worktree_root" >&2
      exit 1
    fi
    if [[ -n "$status" ]]; then
      echo "refusing to archive dirty worktree: $worktree_root" >&2
      exit 1
    fi
    if ! git -C "$worktree_root" symbolic-ref -q HEAD >/dev/null 2>&1; then
      if ! head_oid="$(git -C "$worktree_root" rev-parse --verify HEAD 2>/dev/null)"; then
        echo "refusing to archive worktree whose HEAD cannot be read: $worktree_root" >&2
        exit 1
      fi
      if ! protecting_refs="$(
        git --git-dir="$common_dir" for-each-ref \
          --format='%(refname)' \
          --contains "$head_oid" 2>/dev/null
      )"; then
        echo "refusing to archive worktree whose refs cannot be read: $worktree_root" >&2
        exit 1
      fi
      if [[ -z "$protecting_refs" ]]; then
        echo "refusing to archive unreachable detached HEAD: $worktree_root" >&2
        exit 1
      fi
      if ! origin_refs="$(
        git --git-dir="$common_dir" for-each-ref \
          --format='%(refname)' \
          --contains "$head_oid" \
          refs/remotes/origin 2>/dev/null
      )"; then
        echo "refusing to archive worktree whose origin refs cannot be read: $worktree_root" >&2
        exit 1
      fi
      if [[ -z "$origin_refs" ]]; then
        echo "refusing to archive detached HEAD without origin reachability: $worktree_root" >&2
        exit 1
      fi
    fi

    checked_roots+=("$worktree_root")
    if [[ ! -f "$git_dir/commondir" ]]; then
      continue
    fi
    linked_roots+=("$worktree_root")
    common_dir_known=false
    for ((index = 0; index < ${#parent_common_dirs[@]}; index++)); do
      if [[ "${parent_common_dirs[$index]}" == "$common_dir" ]]; then
        common_dir_known=true
        break
      fi
    done
    if [[ "$common_dir_known" == false ]]; then
      parent_common_dirs+=("$common_dir")
    fi
    printf '%s\0%s\0' "$worktree_root" "$common_dir"
  done < "$discovered_worktrees" > "$validated_worktrees"

  record_context_registration() {
    if [[ -z "$registered_worktree" || "$registered_worktree" != "$context_root/"* ]]; then
      return
    fi
    if [[ -e "$registered_worktree" ]]; then
      if [[ ! -d "$registered_worktree" ]] || ! registered_root="$(cd "$registered_worktree" && pwd -P)"; then
        echo "refusing to archive present unvalidated worktree: $registered_worktree" >&2
        exit 1
      fi
      registration_validated=false
      for ((index = 0; index < ${#linked_roots[@]}; index++)); do
        if [[ "${linked_roots[$index]}" == "$registered_root" ]]; then
          registration_validated=true
          break
        fi
      done
      if [[ "$registration_validated" == false ]]; then
        echo "refusing to archive present unvalidated worktree: $registered_worktree" >&2
        exit 1
      fi
      return
    fi
    if [[ "$registered_detached" == true ]]; then
      if [[ -z "$registered_head" ]]; then
        echo "refusing to archive missing detached worktree whose HEAD cannot be read: $registered_worktree" >&2
        exit 1
      fi
      if ! protecting_refs="$(
        git --git-dir="$registration_common_dir" for-each-ref \
          --format='%(refname)' \
          --contains "$registered_head" 2>/dev/null
      )"; then
        echo "refusing to archive missing worktree whose refs cannot be read: $registered_worktree" >&2
        exit 1
      fi
      if [[ -z "$protecting_refs" ]]; then
        echo "refusing to archive missing unreachable detached HEAD: $registered_worktree" >&2
        exit 1
      fi
      if ! origin_refs="$(
        git --git-dir="$registration_common_dir" for-each-ref \
          --format='%(refname)' \
          --contains "$registered_head" \
          refs/remotes/origin 2>/dev/null
      )"; then
        echo "refusing to archive missing worktree whose origin refs cannot be read: $registered_worktree" >&2
        exit 1
      fi
      if [[ -z "$origin_refs" ]]; then
        echo "refusing to archive missing detached HEAD without origin reachability: $registered_worktree" >&2
        exit 1
      fi
    fi
    printf '%s\0%s\0' "$registered_worktree" "$registration_common_dir"
  }

  : > "$missing_worktrees"
  for ((parent_index = 0; parent_index < ${#parent_common_dirs[@]}; parent_index++)); do
    registration_common_dir="${parent_common_dirs[$parent_index]}"
    if ! git --git-dir="$registration_common_dir" worktree list --porcelain -z > "$repository_registrations"; then
      echo "refusing to archive because parent registrations cannot be read: $registration_common_dir" >&2
      exit 1
    fi
    registered_worktree=""
    registered_head=""
    registered_detached=false
    while IFS= read -r -d '' entry; do
      case "$entry" in
        "")
          record_context_registration
          registered_worktree=""
          registered_head=""
          registered_detached=false
          ;;
        worktree\ *) registered_worktree="${entry#worktree }" ;;
        HEAD\ *) registered_head="${entry#HEAD }" ;;
        detached) registered_detached=true ;;
      esac
    done < "$repository_registrations" >> "$missing_worktrees"
    record_context_registration >> "$missing_worktrees"
  done

  while IFS= read -r -d '' worktree_root && IFS= read -r -d '' common_dir; do
    if ! git --git-dir="$common_dir" worktree remove --force --force "$worktree_root"; then
      echo "failed to deregister worktree: $worktree_root" >&2
      exit 1
    fi
  done < "$validated_worktrees"

  while IFS= read -r -d '' registered_worktree && IFS= read -r -d '' common_dir; do
    if ! git --git-dir="$common_dir" worktree remove --force --force "$registered_worktree"; then
      echo "failed to deregister missing worktree: $registered_worktree" >&2
      exit 1
    fi
  done < "$missing_worktrees"
fi
