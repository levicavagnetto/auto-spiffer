## ADDED Requirements

### Requirement: Screens use the shared shadcn component set

Every interactive control and every card, badge, alert, table, drawer and toast in the renderer SHALL come from the
shared shadcn/ui components in `src/renderer/src/components/ui/`. A hidden native file input MAY remain when a shadcn
Button opens it.

#### Scenario: A screen is built

- **WHEN** a screen shows a text box, password box, checkbox, switch, radio choice, dropdown, tab strip, table,
  expandable section, card, status pill, warning or error box, side drawer, or toast
- **THEN** it is rendered by the matching shadcn component, not by a raw HTML control or hand-styled container

#### Scenario: Warning boxes keep their look

- **WHEN** a screen shows a warning (for example, missing invoice PDFs)
- **THEN** it uses the Alert `warning` variant, drawn with the theme's warning colors

### Requirement: Controls stay accessible and keyboard friendly

Converted controls SHALL keep the accessible role and label they had before, and SHALL work from the keyboard.

#### Scenario: Labels and roles are kept

- **WHEN** a control is converted to a shadcn component
- **THEN** it exposes the same role (checkbox, radio, tab, textbox, combobox, dialog, alert, status) and the same
  visible label text

#### Scenario: Close the matching drawer with the keyboard

- **WHEN** the Review matching drawer is open and the person presses Esc
- **THEN** the drawer closes and focus returns to the control that opened it

#### Scenario: Focus stays in the open drawer

- **WHEN** the Review matching drawer is open and the person presses Tab repeatedly
- **THEN** focus moves only among the drawer's controls
