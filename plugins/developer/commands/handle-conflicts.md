---
description: Handles merge conflicts in a predictable manner, specially tailored to allow future review while the conflict is resolved in unsupervised environment. 
allowed-tools: Bash, Read, Write, Grep, Glob
---

# Resolving conflicts so that humans can later review them

Resolve conflicts using the following process: 

* make a simple list of the conflicted files in .scratch/conflicts-$hash.md
* prepare a plan file in .scratch containing the following for every file:
  * conflicted file name
  * (see the commits on both sides that introduced the conflict)
  * understanding of why the remote changes occurred
  * understanding of why the local changes occurred
  * explanation why the conflict occurs
  * suggested resolution of the conflict
  * assessment if the conflict is caused by lint fix or actual conflicting change
