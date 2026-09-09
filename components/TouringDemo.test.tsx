// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TouringDemo } from './TouringDemo';
afterEach(cleanup);

describe('TouringDemo', () => {
  it('lets the promoter complete the record and the artist read the saved answers', () => {
    render(<TouringDemo embedded />);
    expect(screen.queryByRole('main')).toBeNull();
    fireEvent.click(screen.getByRole('button', {name:'Open the promoter form →'}));
    fireEvent.click(screen.getByRole('button', {name:'Use example details'}));
    fireEvent.click(screen.getByRole('button', {name:'Save advance'}));
    expect(screen.getByText('The advance is complete')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', {name:'See the artist’s day sheet →'}));
    const sheet = screen.getByRole('region', {name:'Day sheet'});
    expect(within(sheet).getByText('Alex Reed')).not.toBeNull();
    expect(within(sheet).getByText('Meet Alex at JFK arrivals at 14:30.')).not.toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Calendar'}));
    expect(screen.getByRole('link',{name:'Open day sheet ↗︎'}).getAttribute('href')).toBe('#'+sheet.id);
    fireEvent.click(screen.getByRole('button', {name:'Reset'}));
    expect(screen.getByText('2 details still needed')).not.toBeNull();
    expect(screen.queryByText('Alex Reed')).toBeNull();
  });
  it('saves partial answers and narrows the follow-up without pretending the show is complete', () => {
    render(<TouringDemo embedded />);
    fireEvent.click(screen.getByRole('button',{name:'Promoter'}));
    fireEvent.change(screen.getByLabelText(/Driver Name/),{target:{value:'Taylor Park'}});
    fireEvent.click(screen.getByRole('button',{name:'Save advance'}));
    expect(screen.getByText('1 detail still needed')).not.toBeNull();
    expect(screen.queryByText('The advance is complete')).toBeNull();
    expect(screen.getByText(/Please confirm these details/).textContent).not.toContain('- Driver Name');
  });
});
