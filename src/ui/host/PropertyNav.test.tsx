import { fireEvent, render, screen } from '@testing-library/react';
import { PropertyNav } from './PropertyNav';

describe('property page navigation', () => {
  it('offers mobile page links and closes after choosing one', () => {
    const { container } = render(<PropertyNav mobile propertyId="cottage" current="moderation" draft />);
    const panel = container.querySelector('details')!;
    expect(panel.querySelector('summary')).toHaveTextContent('Moderation');
    panel.open = true;
    const link = screen.getByRole('link', { name: 'Walls and QR display' });
    expect(link).toHaveAttribute('href', '/host/property/cottage/qr');
    fireEvent.click(link);
    expect(panel.open).toBe(false);
    panel.open = true;
    expect(screen.getByRole('link', { name: 'Publish' })).toHaveAttribute('href', '/host/property/cottage/billing');
  });
  it('closes on outside taps and Escape, restoring keyboard focus', () => {
    const { container } = render(<PropertyNav mobile propertyId="cottage" current="settings" />);
    const panel = container.querySelector('details')!;
    panel.open = true;
    fireEvent.click(document.body);
    expect(panel.open).toBe(false);
    panel.open = true;
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(panel.open).toBe(false);
    expect(panel.querySelector('summary')).toHaveFocus();
  });
  it('keeps desktop navigation links', () => {
    render(<PropertyNav propertyId="cottage" current="settings" />);
    expect(screen.getByRole('link', { name: 'Property view' })).toHaveAttribute('href', '/host/property/cottage');
    expect(screen.getByRole('link', { name: 'Billing' })).toBeInTheDocument();
  });
});
