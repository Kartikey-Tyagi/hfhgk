import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Controls } from '../components/Controls';

describe('Controls Component', () => {
  const defaultParams = {
    deliveryDateFrom: '2026-01-01',
    deliveryDateTo: '2026-01-31',
    cutoffTimeUtc: '12:00:00',
  };

  it('renders initial inputs with provided default values', () => {
    render(
      <Controls
        queryParams={defaultParams}
        onEvaluate={vi.fn()}
        isLoading={false}
      />
    );

    const fromInput = screen.getByLabelText(/Delivery Date From/i) as HTMLInputElement;
    const toInput = screen.getByLabelText(/Delivery Date To/i) as HTMLInputElement;
    const cutoffInput = screen.getByLabelText(/Day-Ahead Cutoff/i) as HTMLInputElement;

    expect(fromInput.value).toBe('2026-01-01');
    expect(toInput.value).toBe('2026-01-31');
    expect(cutoffInput.value).toBe('12:00:00');
  });

  it('displays validation error when end date is earlier than start date', () => {
    const handleEvaluate = vi.fn();
    render(
      <Controls
        queryParams={defaultParams}
        onEvaluate={handleEvaluate}
        isLoading={false}
      />
    );

    const fromInput = screen.getByLabelText(/Delivery Date From/i);
    const toInput = screen.getByLabelText(/Delivery Date To/i);
    const submitBtn = screen.getByRole('button', { name: /Evaluate/i });

    // Set end date before start date
    fireEvent.change(fromInput, { target: { value: '2026-01-10' } });
    fireEvent.change(toInput, { target: { value: '2026-01-05' } });
    fireEvent.click(submitBtn);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'End delivery date cannot be earlier than start delivery date.'
    );
    expect(handleEvaluate).not.toHaveBeenCalled();
  });

  it('displays validation error when cutoff time has invalid format', () => {
    const handleEvaluate = vi.fn();
    render(
      <Controls
        queryParams={defaultParams}
        onEvaluate={handleEvaluate}
        isLoading={false}
      />
    );

    const cutoffInput = screen.getByLabelText(/Day-Ahead Cutoff/i);
    const submitBtn = screen.getByRole('button', { name: /Evaluate/i });

    fireEvent.change(cutoffInput, { target: { value: 'invalid-time' } });
    fireEvent.click(submitBtn);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Decision cutoff time must be in HH:MM or HH:MM:SS format'
    );
    expect(handleEvaluate).not.toHaveBeenCalled();
  });

  it('calls onEvaluate when form is valid', () => {
    const handleEvaluate = vi.fn();
    render(
      <Controls
        queryParams={defaultParams}
        onEvaluate={handleEvaluate}
        isLoading={false}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Evaluate/i });
    fireEvent.click(submitBtn);

    expect(handleEvaluate).toHaveBeenCalledTimes(1);
    expect(handleEvaluate).toHaveBeenCalledWith({
      deliveryDateFrom: '2026-01-01',
      deliveryDateTo: '2026-01-31',
      cutoffTimeUtc: '12:00:00',
    });
  });

  it('updates inputs when preset button is clicked', () => {
    render(
      <Controls
        queryParams={defaultParams}
        onEvaluate={vi.fn()}
        isLoading={false}
      />
    );

    const singleDayBtn = screen.getByRole('button', { name: /Single Day: Jan 1/i });
    fireEvent.click(singleDayBtn);

    const fromInput = screen.getByLabelText(/Delivery Date From/i) as HTMLInputElement;
    const toInput = screen.getByLabelText(/Delivery Date To/i) as HTMLInputElement;

    expect(fromInput.value).toBe('2026-01-01');
    expect(toInput.value).toBe('2026-01-01');
  });

  it('displays validation error when delivery date is outside January 2026', () => {
    const handleEvaluate = vi.fn();
    render(
      <Controls
        queryParams={defaultParams}
        onEvaluate={handleEvaluate}
        isLoading={false}
      />
    );

    const fromInput = screen.getByLabelText(/Delivery Date From/i);
    const toInput = screen.getByLabelText(/Delivery Date To/i);
    const submitBtn = screen.getByRole('button', { name: /Evaluate/i });

    // Set dates in February 2026
    fireEvent.change(fromInput, { target: { value: '2026-02-01' } });
    fireEvent.change(toInput, { target: { value: '2026-02-05' } });
    fireEvent.click(submitBtn);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Delivery dates must be within January 2026'
    );
    expect(handleEvaluate).not.toHaveBeenCalled();
  });

  it('displays UTC label and baseline explanation for cutoff time', () => {
    render(
      <Controls
        queryParams={defaultParams}
        onEvaluate={vi.fn()}
        isLoading={false}
      />
    );

    expect(screen.getByText('UTC')).toBeInTheDocument();
    expect(
      screen.getByText(/Applied on the day before delivery \(D−1\)\. The 12:00 UTC cutoff is an assessment baseline\./i)
    ).toBeInTheDocument();
  });
});
