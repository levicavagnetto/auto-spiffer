# Design

The left panel uses one structure in every phase: progress and status at the top; a compact current-sale, plan, or result card; the phase's controls; a scrollable middle area containing collapsible Activity and PDFs needing upload sections; and a fixed submission reminder at the bottom. The finished state expands PDF details by default, while Activity starts collapsed. During entry, both start collapsed and the PDF count reflects processed invoices. Before entry, the PDF count reflects ready sales without a linked PDF.

The existing run state remains the source of truth. Activity omits routine `missingPdf` events. The PDF section deduplicates invoice numbers and includes failed uploads; clicking a number copies it and reports success or failure. The finished Activity section retains failed-sale reasons, page pictures, and upload-failure details. Detail bodies have bounded height and scroll internally, so actions and the reminder stay visible at the minimum window size.
