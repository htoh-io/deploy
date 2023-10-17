#!/bin/sh

# In case you cannot destroy your resources with pulumi down (probably
# that your resources does no longer exist, you can
# use this script to manually remove their state from Pulumi

for resource in $(pulumi stack --show-urns | rg -o '^.+URN:\s(.+)$' -r '$1')
do
    echo "Removing $resource from Pulumi state"
    pulumi state delete "$resource" --force -y --target-dependents
done