import { toCsvCell } from './profit-report.service';

describe('toCsvCell', () => {
    it('neutralises spreadsheet formulas from customer-controlled text', () => {
        expect(toCsvCell('=HYPERLINK("http://evil","x")')).toBe(`"'=HYPERLINK(""http://evil"",""x"")"`);
        expect(toCsvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
        expect(toCsvCell('+880171')).toBe(`"'+880171"`);
    });

    it('keeps numbers, negatives and percentages intact', () => {
        expect(toCsvCell('-12.50')).toBe('"-12.50"');
        expect(toCsvCell('8.25%')).toBe('"8.25%"');
        expect(toCsvCell(null)).toBe('""');
    });
});
