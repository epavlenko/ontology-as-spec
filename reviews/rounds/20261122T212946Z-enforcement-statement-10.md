Task: enforcement
Step: statement-review
Narrow: false
Number: 10
Time: 2026-11-22T21:29:46Z
Commits: ccfeef2..ccfeef2
By: gpt-6.2-sol (OpenAI, Codex)
Statement-hash: a60616f139129064ffd6908cccda0c57842e0e9da7d22ebe0915d0681743fa57
Checks-listed: 0
Checks-given: 0
Checks-carried: 0
Findings:
- release entry and tag ordering · important · change · fixable
- audit rows ahead of their gates · important · change · fixable
- final merge proof depends on acceptance · important · change · fixable
- owner approval of a whole version · important · change · fixable
- record correction before immutability · important · change · fixable
- positive publication proof outside acceptance · important · change · fixable

## Notes

The release entry and tag ordering came back a fourth time: the condition version 11 set, that neither the entry nor the tag is ever seen alone, cannot hold with a protected pull request, and no source of the owner asks for it. Version 12 drops it: an entry merged through a pull request is pending publication until its tag, the ordinary check on main does not refuse a pending entry, and only the publication process creates the tag. Two findings are lines left over from version 10.
