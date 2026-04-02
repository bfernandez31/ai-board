# From Prompt Engineering to Harness Engineering

For a while, I approached coding agents the same way many people did: by trying
to write better prompts.

If the result was weak, I would tweak the wording, add more context, clarify
constraints, or restate the goal. Sometimes that helped. But the more I used
agents on real software projects, the more obvious the limit became.

The problem was not just the prompt.

The problem was the system around the prompt.

When you use an agent to produce real code, the outcome depends on much more
than the text you send it. It depends on the repository context, the project
rules, the available tools, the permission model, the test strategy, the way
work is decomposed, the artifacts you keep between steps, and the way you
verify results.

In other words: you are not just driving a model. You are driving an execution
harness.

That realization is what led me to build AI-Board.

## Why I Ended Up There

The turning point came when I moved from chat-based AI to terminal agents.

That changes everything. The agent can read code, run commands, edit files,
execute tests, explore multiple approaches, and operate much closer to a real
developer workflow. The upside is huge. But the failure modes show up
immediately too: context grows fast, sessions drift, costs rise, quality
becomes inconsistent, and it becomes hard to replay a good run reliably.

At that point, I realized my main problem was no longer "How do I write a
better prompt?"

It had become: "How do I make agent work reproducible, measurable, and
steerable?"

I was not looking for a fully autonomous system writing code in a corner. I
wanted to stay human on the loop: in control of the frame, the transitions, the
guardrails, the validation rules, and the exceptions. Not reviewing every
single line, but owning the loop.

## AI-Board Is a Harness More Than a Product

From the outside, AI-Board can look like a ticket board powered by coding
agents.

But for me, the core idea is different: it is an orchestration harness.

Instead of asking an agent to "build the feature," I force the work through
explicit stages: Specify, Plan, Build, Verify, Ship. Each stage produces a
persistent artifact: a spec, an implementation plan, code, test results. Each
stage can be reviewed. Each stage can be replayed. And most importantly, each
stage can start from a clean session while still relying on previous artifacts.

That is where Spec-Driven Development became useful to me, not as dogma, but as
a practical response to a context-management problem. Each ticket in AI-Board
carries its own spec and plan as files that live alongside the code. The agent
does not need to remember what was decided three sessions ago. It reads the
artifact and picks up from there.

A long agent session almost always degrades over time. A chain of shorter
sessions, each anchored on explicit artifacts, is far more robust. It is easier
to reason about, easier to compare, easier to replay, and easier to measure.

That is also why AI-Board tracks telemetry at every stage. Token usage, execution
time, cost, quality scores from automated reviews. I do not just want a result.
I want to understand the execution: whether the review agreed with my intuition,
where tokens were spent, and how one workflow configuration compares to another.

That changes the nature of evaluation. You stop judging a vibe. You start
judging a system.

## I Do Not Really Test Prompts Anymore

At some point, I stopped saying that I was "testing prompts."

That is not what I am really doing.

What I test is an execution protocol.

I fix a task or a ticket. I stabilize the repository state. I define the active
rules. I choose the level of structure. I bound the permissions. I decide what
success means. Then I compare runs.

The prompt is only one variable inside a much larger setup.

This matters because when an agent fails, I want to answer concrete questions:

- Was it a prompt problem?
- A context problem?
- A decomposition problem?
- A verification problem?
- A model problem?
- A planning problem?
- A policy problem?

Without a harness, it is very easy to tell yourself the wrong story. With a
harness, you can start producing actual engineering feedback instead of
anecdotes.

## My Second System: Deterministic Evaluation Loops

AI-Board solves part of the problem, especially at the product and workflow
level. But I also use another system outside of it, one that is more local and
more experimental.

The idea is simple: run the agent inside a short loop with binary,
deterministic acceptance criteria.

Not vague criteria like "this looks better." Real signals. A test passes or
fails. Lint is green or red. An invariant is respected or broken. An expected
output exists or does not. In AI-Board, the Verify stage does exactly this: it
runs the test suite against the agent's work and produces a pass/fail verdict.
The agent does a small change, re-runs the check, and decides what to do next
from that result.

That enables a very different style of iteration.

The agent is no longer allowed to convince itself that it "probably fixed it."
It has to prove it against an external signal. And because the loop is short,
it tends to produce smaller, more targeted changes instead of large fragile
rewrites.

This is one of the biggest mindset shifts I have had with coding agents: if you
can define deterministic acceptance criteria, you can often turn a fuzzy agent
workflow into a controlled optimization loop.

## Parallelizing Solutions Instead of Hoping for One

When the problem benefits from it, I add another layer: parallel exploration.

Instead of sending one agent down one path and hoping it works, I run several
paths in parallel and let a parent agent arbitrate. This is also why I have
been interested in setups like Claude Code Agent Teams: a lead session can
coordinate multiple teammates, each with its own context, then synthesize the
results and relaunch with targeted fixes.

That model matches how I think about hard agent tasks.

One agent explores one hypothesis. Another tries a different implementation
path. A third acts more like a critic or verifier. The parent agent collects
the outputs, rejects weak directions, keeps the strongest ideas, and triggers
another iteration.

What matters here is not the "wow" factor of multiple agents. It is the ability
to turn a blocked problem into a controlled search process.

Of course, this is not free. Parallel agents cost more tokens and add
coordination overhead. They only make sense when the work can actually be
split. But when they do make sense, they are much more powerful than a single
long session slowly drifting toward a mediocre answer.

## Why I Say Human on the Loop

I deliberately say human on the loop, not fully autonomous coding.

I do not want to be in the loop validating every command or every edit. That
would be too slow and would remove much of the value of using agents in the
first place.

But I also do not want a system that decides on its own what "good enough"
means.

The role of the human changes. The human is no longer manually producing every
step of the output. The human designs the harness: the stages, the artifacts, the quality gates, the
acceptance criteria, the review checkpoints, the escalation paths, and the stop
conditions. That is what I spend most of my time on with AI-Board. Not writing
code, but shaping the system that writes code.

That is a less visible role, but a much more strategic one.

In practice, I think this is one of the most important skills emerging around
coding agents: not just knowing how to talk to models, but knowing how to
design the system in which they work.

## What I Learned

The biggest gains I have seen do not always come from a better model or a
smarter prompt.

They often come from a better harness.

A good artifact can be more valuable than a long session. A strong verification
loop can be more useful than an elegant instruction. A binary acceptance
criterion can beat intuition. A well-orchestrated team of agents can outperform
one agent left alone for too long.

That is why I keep building AI-Board.

Not because I think we are about to stop coding. Despite the joke, that is not
really the point.

I built it because I wanted a better way to understand how coding agents behave
in real projects. A better way to compare approaches. A better way to measure
quality. A better way to stay responsible for the system without micromanaging
every step.

So for me, the real topic is no longer prompt engineering.

The real topic is harness engineering.
