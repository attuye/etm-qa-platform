import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from './role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'enum', enum: Role, default: Role.Customer })
  role!: Role;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}