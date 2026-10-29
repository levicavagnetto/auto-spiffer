## MODIFIED Requirements

### Requirement: Settings for updates and logs
Settings SHALL show the version and update status, **Check now**, the automatic updates switch, and **Open folder** for the logs. When Check now fails, Settings SHALL show a temporary plain-language error toast without Electron's IPC error wrapper.

#### Scenario: Check now
- **WHEN** the person clicks Check now and no newer version exists
- **THEN** Settings says "Auto Spiffer 1.0.0 · up to date, checked just now"

#### Scenario: Check now in a development build
- **WHEN** the person clicks Check now without installing Auto Spiffer
- **THEN** a temporary toast says exactly "Install Auto Spiffer to check for updates"
