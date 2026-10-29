# Design

The update controller receives a `canCheck` dependency from the main process, based on `app.isPackaged`. Its startup scheduling and `checkNow` operation return without checking when `canCheck` is false. `setAutomatic` still saves and publishes the preference. The existing Check now IPC error remains, while installed builds continue using the same controller path.
