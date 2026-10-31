# Design

Apply a class to the renderer document while either screen is active. CSS hides scrollbar chrome on that document and its nested scroll containers. The class is removed when navigating away. This keeps existing overflow and keyboard behavior and does not inject styling into the separate ProRewards WebContentsView.
