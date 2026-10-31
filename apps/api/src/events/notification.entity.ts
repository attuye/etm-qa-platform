import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  eventId!: string;

  @Index()
  @Column()
  customerId!: string;

  @Column()
  orderId!: string;

  @Column('text')
  message!: string;

  @CreateDateColumn()
  createdAt!: Date;
}