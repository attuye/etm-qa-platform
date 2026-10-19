import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { OrderStatus } from './order-status.enum';

@Entity('orders')
@Index(['customerId', 'idempotencyKey'], { unique: true })
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer?: User;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @Column()
  product!: string;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ name: 'unit_price_cents', type: 'int' })
  unitPriceCents!: number;

  @Column({ name: 'total_cents', type: 'int' })
  totalCents!: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.Pending })
  status!: OrderStatus;

  @Column({ name: 'idempotency_key' })
  idempotencyKey!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}