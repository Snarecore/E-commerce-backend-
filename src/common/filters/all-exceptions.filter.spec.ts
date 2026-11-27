import { ArgumentsHost, ConflictException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

const hostFor = () => {
    const response: any = { status: jest.fn().mockReturnThis(), json: jest.fn(), headersSent: false };
    const host = {
        getType: () => 'http',
        switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({ method: 'POST', originalUrl: '/api/v1/x' }) }),
    } as unknown as ArgumentsHost;
    return { host, response };
};

describe('AllExceptionsFilter', () => {
    const filter = new AllExceptionsFilter();
    beforeAll(() => jest.spyOn((filter as any).logger, 'error').mockImplementation(() => undefined));

    it('passes HttpExceptions through with their status and message', () => {
        const { host, response } = hostFor();
        filter.catch(new ConflictException('SKU "X1" is already used.'), host);
        expect(response.status).toHaveBeenCalledWith(409);
        expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'SKU "X1" is already used.' }));
    });

    it('masks unexpected errors such as raw database failures', () => {
        const { host, response } = hostFor();
        filter.catch(new Error("ER_DUP_ENTRY: Duplicate entry 'a@b.com' for key 'user.IDX_email'"), host);
        expect(response.status).toHaveBeenCalledWith(500);
        const body = response.json.mock.calls[0][0];
        expect(JSON.stringify(body)).not.toMatch(/ER_DUP_ENTRY|a@b\.com|IDX_email/);
        expect(body.errorId).toEqual(expect.any(String));
    });
});
