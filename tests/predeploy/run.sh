#!/bin/bash
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"
{ bash "$D/sa-check.sh"; echo __END; } | verdict
