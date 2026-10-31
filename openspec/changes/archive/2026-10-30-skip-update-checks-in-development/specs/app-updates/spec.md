## ADDED Requirements

### Requirement: Development builds do not check updates
An unpackaged development build SHALL NOT contact the update feed at startup, on a schedule, or when the person turns on Install updates automatically. The preference SHALL still be saved and displayed. Check now SHALL continue to explain that Auto Spiffer must be installed to check for updates.

#### Scenario: Turn on automatic updates in development
- **WHEN** the person turns off and then turns on Install updates automatically in a development build
- **THEN** the setting is saved and the update state remains idle without checking the feed
