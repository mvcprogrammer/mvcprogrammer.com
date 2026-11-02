import { TestBed } from '@angular/core/testing';
import { Nexus } from './nexus';

describe('Nexus', () => {
  it('should render the cross-reference with the reading path collapsed and the two tables filled', async () => {
    // Arrange
    const fixture = TestBed.createComponent(Nexus);

    // Act
    await fixture.whenStable();

    // Assert
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('h1')?.textContent).toContain('JD cross-reference');
    expect(host.textContent).not.toContain('Houston');
    const details = host.querySelector('details#jd-reading') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.querySelectorAll('ol li')).toHaveLength(5);
    const demo = host.querySelector('details#jd-demo') as HTMLDetailsElement;
    expect(demo.open).toBe(false);
    expect(demo.querySelectorAll('ol li')).toHaveLength(7);
    expect(demo.querySelector('a[href$="HL7-ETL-DEMO.pdf"]')).not.toBeNull();
    expect(host.querySelectorAll('#jd-matrix-table tbody tr')).toHaveLength(23);
    expect(host.querySelectorAll('#jd-gaps-table tbody tr')).toHaveLength(8);
    expect(host.querySelectorAll('.jd-grade.is-yes')).toHaveLength(11);
    expect(host.querySelectorAll('.jd-grade.is-near')).toHaveLength(7);
    expect(host.querySelectorAll('.jd-grade.is-no')).toHaveLength(5);
    expect(host.querySelectorAll('.jd-case')).toHaveLength(5);
    expect(host.querySelectorAll('.jd-case .jd-takeaway strong')).toHaveLength(5);
    expect(host.querySelectorAll('.jd-points li > strong').length).toBeGreaterThanOrEqual(16);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');

    // Act: leaving the page restores the document
    fixture.destroy();

    // Assert
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });
});
