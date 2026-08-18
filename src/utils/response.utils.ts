export interface ApiResponse<T> {
    status: 'success' | 'failed';
    statusCode: number;
    message: string;
    data?: T | null;
}

export class ResponseUtils {
    static successResponseHandler<T>(
        statusCode: number,
        message: string,
        dataKey: string | null = 'data',
        data?: T
    ): ApiResponse<T> {
        return {
            status: 'success',
            statusCode,
            message,
            [dataKey ?? 'data']: data,
        } as ApiResponse<T>;
    }

    static errorResponseHandler<T>(
        statusCode: number,
        message: string,
        dataKey: string | null = 'errorData',
        data?: T
    ): ApiResponse<T> {
        return {
            status: 'failed',
            statusCode,
            message,
            [dataKey ?? 'errorData']: data,
        } as ApiResponse<T>;
    }

    static deleteResponseHandler(
        statusCode: number,
        message: string,
        deleted: boolean
    ): ApiResponse<boolean> {
        return {
            status: 'success',
            statusCode,
            message,
            data: deleted
        };
    }
}
