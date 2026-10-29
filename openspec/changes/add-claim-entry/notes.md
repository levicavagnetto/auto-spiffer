# Claim entry verification notes

## Automated checks

- The committed claim-page fixture and stub completed a two-sale run with one generated invoice PDF. A restart skipped both sales and did not upload the PDF again. The stub recorded no Next click.
- Separate stub runs covered a duplicate warning answered No, a rejected sale, stopping during a line and restarting, and closing during a line after confirmation.
- A generated sale also completed against the private saved claim page on the development machine. That test skips on machines without `private-data/`.

## Supervised live run

Pending. Use an unsubmitted month, start the development app with `AUTO_SPIFFER_LIVE_MAX_LINES=2`, check those two lines and their PDF uploads on the website, then relaunch without the limit and run the rest. Record actual Add and upload timings, outcomes, and any surprises here. The person submits the claim.

The person reported that live tire lines appeared on the claim page and that running again skipped them. The run
had multiple invoices without selected PDFs, and their warnings overflowed the Enter pane. The layout regression
is tracked as task 2.4. PDF upload and final submission have not been confirmed for this live run.

Task 2.4 now groups those invoices under a count in a bounded scroll area. A component test covers 20 missing
PDFs, and an Electron layout test checks that the details scroll, controls stay visible, and the website pane
remains usable at the minimum window size.

The person also reported that scrolling down Review moved the sidebar out of view. Task 2.5 keeps the sidebar
visible and resets page scroll after navigation. An Electron test first reproduced the sidebar more than a viewport
above the window, then passed after the fix at the minimum window size.

After the sidebar fix, the person reported that the live-run check passed, all tire data was entered successfully,
and the sidebar worked during their manual test. The two-line checkpoint, any available PDF uploads, final manual
submission, and run timings are awaiting confirmation before task 3.1 is marked complete.

The person later confirmed that the planned two-line checkpoint and PDF uploads worked. The earlier report that all
tire data was entered covers running the remaining lines. Final manual submission and Add/upload timings have not
been reported, so task 3.1 remains open.

The app log contains timing records, but it mixes live activity with development checks. On October 26 it recorded
80 Add operations (200–2264 ms, 1170 ms average) and 34 uploads (104–1657 ms, 590 ms average). On October 27 it
recorded 30 Adds (245–400 ms, 281 ms average), and on October 28 it recorded 16 Adds (180–502 ms, 242 ms average).
These are log aggregates, not isolated timings for the two-line live checkpoint. The user confirmed both the
checkpoint and PDF uploads worked. Final manual submission has not been reported.

## Demo invoice test

The old project's PDF writer generated 30 clearly marked demo invoices for 33 importable October sales rows in
the person's workbook. One row with a nonpositive quantity was skipped because the app cannot import it as a sale.
All PDFs were checked for readability and matching embedded invoice numbers. The person then tested the demo
invoices in the app and reported that everything worked. This confirms the test flow; it does not establish that
real invoice PDFs were uploaded or that a live claim was submitted.
