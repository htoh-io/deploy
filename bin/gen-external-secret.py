#!/usr/bin/env python3

import subprocess
import json
import yaml

def to_secret_key(secret):
    name = secret['name']
    id = secret['id']
    return {
        'secretKey': name, 
        'remoteRef': {
            'key': f'id:{id}', 
            'version': 'latest_enabled'
        }
    }

PROJECT_ID = '9c3369b0-7bf1-4453-a56a-1e5c7ff0fa97' # production
PREFIX = 'htoh-'
result = subprocess.run(['scw', 'secret', 'secret', 'list', f'project-id={PROJECT_ID}', '-o', 'json'], stdout=subprocess.PIPE)
secrets = json.loads(result.stdout)

secrets = [secret for secret in secrets if secret['name'].startswith(PREFIX)]
output = [to_secret_key(secret) for secret in secrets]

print(yaml.dump(output, default_flow_style=False))