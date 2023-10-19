#!/usr/bin/env python3

import base64
import json
import sys

# decode values in base64 in a JSON file

data = json.loads(sys.stdin.read())
secrets = {key: base64.b64decode(value).decode("utf-8")  for (key, value) in data.items()}
sys.stdout.write(json.dumps(secrets, indent=4))