---
description: Handles merge conflicts in a predictable manner, specially tailored to allow future review while the conflict is resolved in unsupervised environment. 
allowed-tools: Bash, Read, Write, Grep, Glob
---

# Resolving conflicts so that humans can later review them

* make a list of the conflicted files in .scratch/conflicts-$hash.md
* commit the conflicted files, including the conflict markers
* prepare a plan file in .scratch containing the following for every file:
  * conflicted file name
  * (see the commits on both sides that introduced the conflict)
  * understanding of the remote changes 
  * understanding of the local changes
  * explanation why the conflict occurs
  * suggested resolution of the conflict
  * assessment if the conflict is caused by lint fix or actual conflicting change
* output a git command that can be used to squash the commit, so that no conflict markers ever get to the base branch
