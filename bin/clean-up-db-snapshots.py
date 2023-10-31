#!/usr/bin/env python3

import json
import yaml
import subprocess

PROJECT_ID = '9c3369b0-7bf1-4453-a56a-1e5c7ff0fa97' # production
# INSTANCE_NAME = 'htoh-prd'
INSTANCE_ID = '686c3e8d-850e-4593-88ce-ecc671dedc18'

result = subprocess.run(['scw', 'rdb', 'snapshot', 'list', f"instance-id={INSTANCE_ID}", '-o', 'json'], stdout=subprocess.PIPE)
snapshots = json.loads(result.stdout)

deleting_snapshots = [
    snapshot 
    for snapshot in snapshots 
    # if snapshot['instance_name'] == INSTANCE_NAME
]

for snapshot in deleting_snapshots:
    snapshot_id = snapshot['id']
    print(f"Deleting snapshot {snapshot_id}, region={snapshot['region']}")
    result = subprocess.run(['scw', 'rdb', 'snapshot', 'delete', snapshot_id], stdout=subprocess.PIPE)
    print(result.stdout.decode("utf-8"))
    print("\n")

# print(yaml.dump(deleting_snapshots, default_flow_style=False))