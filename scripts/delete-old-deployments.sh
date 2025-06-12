#!/usr/bin/env sh

repo=maxi-k/worldspecs
(
    gh api \
        --method GET \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        /repos/$repo/deployments
) \
    | jq -r '.[].id' \
    | sort -n | head -n-1 \
    | (
    while read line; do
        echo "deleting deployment $line"
        gh api \
            --method DELETE \
            -H "Accept: application/vnd.github+json" \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            /repos/$repo/deployments/$line
    done
)
