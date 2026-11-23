# Run guide: a refusal at the desk is understood

> Example run guide (part 6 of the approach): how an agent carries out a check of run of the catalogue on the desk's screen of the mockup. What must hold is in `../checks.md`; this page says only how to get there, what shows after each step, what to keep and where a run gets lost.

<!-- ont: check.screens.refusal-understandable@e84b58 -->
## A librarian understands why a checkout is refused

Start in the mockup, `example/mockup/index.html`, opened from the file system in a browser.

1. Open the tab Desk. It shows the item `drill-1`, the member `ana` and the button Check out.
2. Click Check out. A note appears under the buttons: the message of the refusal. Copy its text as it shows.
3. **Fresh reader.** Give a fresh reader, a model without context, only what a librarian who has not read the rules would see: the screen of the desk with the message, as text or as a screenshot, and nothing else, not the ontology, not the catalogue, not the rules. Ask it two questions: why the checkout was refused, and what would make it possible.
4. Read its answers against the check's THEN. When both follow from the message alone, the check passes; an answer that needs the rules is a fail, named with the message.

Keep, named by the check's ID and the date: the screenshot or the text of the screen, what the fresh reader was given, and its answers.

Traps:

- The reviewer reading the message itself proves nothing: it knows the rules, so any message seems clear.
- Giving the fresh reader the name of the rule, such as the invariant's ID, tells it the answer; give it the screen only.
