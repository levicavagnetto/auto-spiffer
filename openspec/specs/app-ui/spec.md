# app-ui Specification

## Purpose
Shared presentation rules for app screens that are not owned by a single feature, such as how scrolling looks.

## Requirements

### Requirement: Quiet scrolling on Review and Enter claims

The app SHALL hide scrollbar tracks on the Review and Enter claims screens while preserving scrolling in every app-owned scroll container.

#### Scenario: Review a long list

- **WHEN** the Review screen contains more sales than fit in the window
- **THEN** the person can scroll to every sale without a visible app scrollbar track

#### Scenario: Inspect entry details

- **WHEN** the Enter claims activity or invoice list exceeds its visible area
- **THEN** the person can scroll its contents without a visible app scrollbar track

#### Scenario: Leave those screens

- **WHEN** the person navigates to another screen
- **THEN** that screen uses its normal scrollbar presentation
