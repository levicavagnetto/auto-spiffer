# Design

The existing `missingInvoices` array in `SalesSnapshot` remains the source of truth. A small renderer component displays its count and the existing guidance. Its details start collapsed; when expanded, a scrollable wrapping list displays one button per invoice. Clicking a button writes only that invoice number to the clipboard and shows success or failure feedback. The component disappears when no invoices are missing. No new IPC or stored state is needed.
