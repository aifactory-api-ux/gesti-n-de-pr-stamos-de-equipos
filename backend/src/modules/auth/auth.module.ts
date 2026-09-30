import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsuarioEntity } from '../../database/entities/usuario.entity';
import { PrestamoEntity } from '../../database/entities/prestamo.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { AzureAuthGuard } from '../../common/guards/azure-auth.guard';

/**
 * Módulo de autenticación corporativa SSO.
 * Configura la integración con Passport, JwtModule asíncrono desde ConfigService,
 * repositorios TypeORM para usuarios y préstamos, controladores y estrategias.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([UsuarioEntity, PrestamoEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>('jwt.secret') ||
          'Kz81mK!p98Z2#e9X1v82N!w4Q71Lp0x9',
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn') || '8h',
        },
      }),
    }),
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AzureAuthGuard],
  exports: [AuthService, JwtModule, PassportModule, JwtStrategy, AzureAuthGuard],
})
export class AuthModule {}
