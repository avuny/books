# Proposal: split AGENTS.md

**Problem.** Root AGENTS.md is about 660 lines made of three documents: the root guide (lines 1-134), a 'how to build modules' guide (7 sections), and a pasted task prompt ('Establish Synchronized, Contract-First Module Specifications'). Agents load all of it every session, which costs tokens and mixes instructions with a finished task.

**Change.** Keep the root guide plus a short pointer list. Move the module guide to `.agents/workflows/new-module.md` (partly duplicated there already). Move the task prompt to `docs/templates/spec-kickoff-prompt.md`.

**Cost.** Pure doc moves. Left untouched here because it is a structural change.
