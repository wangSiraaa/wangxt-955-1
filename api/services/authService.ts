import bcrypt from 'bcryptjs';
import * as userRepository from '../repositories/userRepository.js';
import { generateToken } from '../middleware/auth.js';
import type { LoginRequest, LoginResponse } from '../../shared/types.js';

export async function login(request: LoginRequest): Promise<LoginResponse> {
  const result = await userRepository.findByUsername(request.username);
  
  if (!result) {
    throw new Error('用户名或密码错误');
  }

  const { user, passwordHash } = result;
  
  if (user.role !== request.role) {
    throw new Error('该账号不属于此角色');
  }

  const isPasswordValid = await bcrypt.compare(request.password, passwordHash);
  
  if (!isPasswordValid) {
    throw new Error('用户名或密码错误');
  }

  const token = generateToken(user);

  return {
    token,
    user,
  };
}
