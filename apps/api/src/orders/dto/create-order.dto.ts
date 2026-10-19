import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  product!: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;

  @IsInt()
  @Min(1)
  unitPriceCents!: number;
}