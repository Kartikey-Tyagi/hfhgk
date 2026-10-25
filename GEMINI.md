# Wind Forecast Intelligence — Project Instructions

## 1. Project Overview

Build a web application that helps a UK energy utility understand national wind generation forecasts and quantitatively evaluate their accuracy.

The application must use:
- React with TypeScript for the frontend.
- Python for the backend.
- Elexon BMRS API as the exclusive data source for generation actuals and forecasts.

This is an engineering assessment. Prioritize correctness, maintainability, testing, and a professional user experience over unnecessary complexity.

## 2. Business Requirements

The application must support two primary capabilities:

1. Display the latest eligible wind generation forecasts available at a specified day-ahead purchasing decision cutoff.
2. Evaluate those forecasts against actual wind generation using quantitative accuracy metrics.

Scope is limited to national wind generation using Elexon's FUELHH and WINDFOR datasets.

Do not introduce unrelated datasets, external weather services, electricity prices, or demand forecasting.

## 3. Critical Data Rules

- FUELHH actuals must be filtered to fuelType = WIND.
- Use startTime to align forecasts and actuals to the correct delivery intervals.
- Use publishTime to determine forecast availability.
- Never select a forecast published after the applicable decision cutoff.
- Normalize timestamps using timezone-aware datetime handling.
- Use UTC internally and Europe/London for user-facing timestamps.
- Preserve missing values; never silently replace missing generation with zero.
- Report data coverage alongside accuracy metrics.
- Do not assume the API provides every historical forecast vintage. Verify this before implementing historical accuracy calculations.
- Do not invent API response fields, query parameters, or dataset behavior.

## 4. Forecast Accuracy

Implement and test:
- Mean Absolute Error (MAE).
- Root Mean Squared Error (RMSE).
- Mean Error (ME), with error defined as forecast minus actual.

Only valid forecast-actual pairs may contribute to these metrics.

Handle missing observations, duplicate records, zero generation, and empty datasets explicitly.

## 5. Engineering Principles

- Keep the frontend, API routes, external API client, data-processing logic, and metric calculations appropriately separated.
- Use clear names, small functions, type hints, and input validation.
- Avoid unnecessary abstractions, dependencies, and infrastructure.
- Never hardcode fabricated generation data into production behavior.
- Mock external APIs in automated tests.
- Include useful loading, empty, and error states in the frontend.
- Keep business logic in the Python backend rather than duplicating it in React.
- Add or update tests when implementing or changing business logic.
- Never claim that a feature or test works without verifying it.

## 6. Development Workflow

Before implementing a major feature:

1. Inspect the existing project and relevant documentation.
2. Explain the proposed approach briefly.
3. Identify assumptions and potential edge cases.
4. Implement in small, reviewable increments.
5. Run relevant tests and inspect the results.
6. Summarize changes, verification results, and outstanding issues.

Do not overwrite existing work without inspecting it first.

Do not start implementing the entire application in a single operation.

## 7. Documentation

Maintain documentation covering:
- Business requirements.
- Architecture and data flow.
- Elexon API contracts.
- Forecast selection and decision-cutoff assumptions.
- Accuracy metric definitions.
- Missing-data handling.
- Testing and local setup.
- AI tools used during development.

Explicitly disclose actual AI usage in the final README.

## 8. Scope and Assumptions

The relevant decision dates are in January 2026.

The exact decision cutoff, delivery-date boundaries, and historical forecast availability must be investigated and documented before finalizing the calculations.

Do not silently assume that decision dates and delivery dates are identical.

Do not implement purchasing recommendations because consumer demand, other generation, and market prices are outside the available data scope.