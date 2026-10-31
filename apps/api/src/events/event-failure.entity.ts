import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type EventFailureStatus = 'retrying' | 'parked';

@Entity('event_failures')
export class EventFailure {
  @PrimaryColumn()
  eventKey!: string;

  @Column()
  subscription!: string;

  @Column({ type: 'varchar' })
  status!: EventFailureStatus;

  @Column('text')
  reason!: string;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column('text')
  payload!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}