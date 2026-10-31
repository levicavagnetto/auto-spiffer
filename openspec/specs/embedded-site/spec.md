# embedded-site Specification

## Purpose
How the ProRewards website is shown inside the app window so it looks contained in the app's own cards.

## Requirements

### Requirement: Embedded website sits between rounded app bars
The native ProRewards website view SHALL retain square corners. On both ProRewards and Enter claims screens, a top URL bar and a bottom bar SHALL visually contain the webpage. The containing card SHALL round the top bar's upper corners and the bottom bar's lower corners.

#### Scenario: Website view is shown
- **WHEN** the website view is positioned on either screen
- **THEN** its corners remain square and the bottom bar sits directly beneath it
- **AND** the page keeps its existing bounds and remains usable
