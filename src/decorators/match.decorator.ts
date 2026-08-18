import {
    registerDecorator,
    ValidationArguments,
    ValidationOptions
} from 'class-validator';

export function Match(
    targetProperty: string,
    validationOptions?: ValidationOptions
): PropertyDecorator {
    return (object: Object, propertyName: string) => {
        registerDecorator({
            name: 'Match',
            target: object.constructor,
            propertyName: propertyName,
            constraints: [targetProperty],
            options: {
                ...validationOptions,
                message: validationOptions?.message || `${propertyName} must match ${targetProperty}`
            },
            validator: {
                validate(value: unknown, args: ValidationArguments): boolean {
                    const [relatedPropertyName] = args.constraints;
                    const relatedValue = (args.object as any)[relatedPropertyName];
                    return value === relatedValue;
                }
            }
        });
    };
}
