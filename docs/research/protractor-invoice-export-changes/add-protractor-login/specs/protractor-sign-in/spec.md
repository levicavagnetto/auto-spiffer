## ADDED Requirements

### Requirement: Save the Protractor login
Settings SHALL show a **Protractor login** card above the ProRewards sign-in card, with a username, a password,
**Save** and **Forget login**. The password SHALL be stored only encrypted with the Windows account, never in plain
text, never in logs, and never sent to the screens after saving; the screen only learns that one is saved. The
Protractor login SHALL be stored separately from the ProRewards login, and changing one SHALL NOT change the other.

#### Scenario: Login saved
- **WHEN** the person enters a username and password and clicks Save
- **THEN** the card shows the username and "Saved, encrypted with your Windows account", and no file the app writes contains the password text

#### Scenario: Missing field
- **WHEN** the person clicks Save with an empty username or password
- **THEN** nothing is saved and the card says which field to fill in

#### Scenario: Encryption not available
- **WHEN** Windows cannot encrypt the password
- **THEN** the app does not save it and says the password cannot be stored safely on this computer

#### Scenario: Forget login
- **WHEN** the person clicks Forget login
- **THEN** the saved username and password are deleted and the ProRewards login is unchanged

#### Scenario: Saved password cannot be read
- **WHEN** the saved password cannot be decrypted, for example under a different Windows account
- **THEN** the app treats it as no saved login and the card asks the person to enter it again

### Requirement: The login is optional
The app SHALL work as before when no Protractor login is saved. Fetching invoices from Protractor SHALL be skipped,
and tire sales without a PDF SHALL stay on the missing-PDF list.

#### Scenario: No login saved
- **WHEN** the person loads a Material Sales export with no Protractor login saved
- **THEN** the app does not contact Protractor, and the missing-PDF list says that saving a Protractor login in Settings lets the app get these PDFs

### Requirement: Protractor login state shown
The card SHALL show the result of the most recent Protractor sign-in in this session, in plain words: not tried
yet, signed in, username or password not accepted, or could not reach Protractor. The state SHALL reset when the
login is saved again or forgotten, and SHALL NOT be stored between sessions.

#### Scenario: Wrong password
- **WHEN** a Protractor sign-in is refused
- **THEN** the card says the username or password was not accepted and to check them

#### Scenario: Login changed
- **WHEN** the person saves a new password after a refused sign-in
- **THEN** the card shows "Not tried yet"
