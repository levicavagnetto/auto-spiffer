# Design

Settings catches the rejected `checkForUpdates` IPC call. It maps the known development-build error to the exact user-facing phrase and shows a dismissible, seven-second toast. Other update-check failures use a generic plain-language toast. The existing error toast markup is shared with Match tires so both flows look and behave the same.
