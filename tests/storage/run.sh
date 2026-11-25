#!/bin/bash
# الحفظ المحلي: دالة الحفظ الحقيقية من index.html مع تخزين وهمي محدود السعة. لا متصفح ولا شبكة.
D=$(cd "$(dirname "$0")" && pwd); . "$D/../lib.sh"
{ node "$D/save.cjs"; echo __END; } | verdict
