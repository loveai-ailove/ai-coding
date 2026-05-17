# AI Admin System

基于 **Next.js 16 + React 19 + Prisma 7 + MySQL 8.4** 的企业后台管理系统模板，已覆盖认证鉴权、RBAC、系统管理、日志审计等核心能力。

## 快速开始

### 前置要求

- Node.js 20+
- MySQL 8.4+（本地或 Docker）
- npm

### 数据库准备

使用项目自带的 Docker Compose 快速启动 MySQL：

```bash
cp .env.example .env
docker compose up -d
```

或手动创建数据库：

```sql
CREATE DATABASE ai_coding CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 安装与启动

```bash
git clone https://github.com/loveai-ailove/AI-Admin-System.git
cd AI-Admin-System
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

按 `.env.example` 的模板修改数据库连接信息后，访问 [http://localhost:3000](http://localhost:3000)。

### 初始化默认数据

系统为空库时，登录页会显示 **"初始化系统默认数据"** 按钮。点击后自动创建默认部门、角色、菜单、权限和管理员账号：

```text
用户名：admin
密码：Admin123!
```

首次登录后建议立即在个人中心修改默认密码。

## 项目结构

```text
src/
├── app/
│   ├── (auth)/login/page.tsx          # 登录页
│   ├── (admin)/admin/
│   │   ├── layout.tsx                  # 后台布局
│   │   ├── page.tsx                    # 工作台
│   │   ├── profile/                    # 个人中心
│   │   ├── logs/                       # 日志管理
│   │   └── system/                     # 系统管理
│   └── api/
│       ├── auth/                       # 认证、验证码、个人中心接口
│       └── admin/                      # 系统管理与日志接口
├── components/
│   ├── admin/                          # 头部、侧边栏、面包屑
│   ├── auth/                           # 登录表单、滑块验证码
│   ├── logs/                           # 日志组件
│   ├── profile/                        # 个人中心
│   ├── system/                         # 用户、角色、菜单、部门管理
│   └── ui/                             # 通用 UI 组件
├── lib/
│   ├── auth/                           # 会话、用户、权限校验
│   ├── system/                         # 初始化、部门树处理
│   ├── validators/                     # Zod 校验
│   ├── captcha.ts                      # 滑块验证码
│   ├── logger.ts                       # 日志记录
│   ├── api.ts
│   └── prisma.ts                       # Prisma Client
├── prisma/
│   ├── schema.prisma                   # 数据模型定义
│   └── migrations/                     # 数据库迁移
```

## 技术栈

| 技术 | 用途 |
|------|------|
| [Next.js 16](https://nextjs.org/) + [React 19](https://react.dev/) | 全栈框架，App Router |
| [Prisma 7](https://www.prisma.io/) + [MySQL 8.4](https://www.mysql.com/) | ORM 与数据库 |
| [Tailwind CSS 4](https://tailwindcss.com/) | 样式 |
| [Zod 4](https://zod.dev/) | 请求参数校验 |
| [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | 密码哈希 |
| [TypeScript 5](https://www.typescriptlang.org/) | 类型安全 |

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run lint` | 代码检查 |
| `npm run db:migrate` | 执行 Prisma 迁移 |
| `npm run db:generate` | 生成 Prisma Client |
| `npm run db:push` | 推送 Schema 到数据库 |
| `npm run db:studio` | 打开 Prisma Studio |

## 开发协作建议

- 页面代码优先放在 `src/app` 与 `src/components`，避免业务逻辑堆到页面文件
- 服务端认证、权限判断、日志记录等公共逻辑优先复用 `src/lib`
- 新增接口时同时补齐 Zod 参数校验、权限校验和必要的日志记录
- 调整菜单、角色、按钮权限时，同步检查初始化数据与 RBAC 关联逻辑
- 涉及密码、Token、会话、日志字段时，按敏感信息处理，避免明文输出
- 提交前至少执行 `npm run lint`，涉及数据结构变更时补充执行 `npm run db:migrate`

## 项目结构

下面的目录是日常开发最常接触的区域。新增功能时，通常会同时涉及页面、组件、接口、校验器和权限逻辑，建议先从这里建立整体认知：

```text
src/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx                 # 登录页
│   ├── (admin)/
│   │   └── admin/
│   │       ├── layout.tsx                 # 后台布局
│   │       ├── page.tsx                   # 工作台
│   │       ├── profile/page.tsx           # 个人中心
│   │       ├── logs/                      # 日志管理页面
│   │       └── system/                    # 系统管理页面
│   ├── api/
│   │   ├── auth/                          # 认证、验证码、个人中心接口
│   │   └── admin/                         # 系统管理与日志接口
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                           # 根路由，根据登录态跳转
├── components/
│   ├── admin/                             # 后台头部、侧边栏、面包屑
│   ├── auth/                              # 登录表单、滑块验证码
│   ├── logs/                              # 登录日志、操作日志组件
│   ├── profile/                           # 个人中心
│   ├── system/                            # 用户、角色、菜单、部门管理组件
│   └── ui/                                # 通用 UI 组件
├── lib/
│   ├── auth/                              # 会话、当前用户、权限校验
│   ├── system/                            # 初始化与部门树处理
│   ├── validators/                        # Zod 校验
│   ├── captcha.ts                         # 滑块验证码生成与校验
│   ├── logger.ts                          # 登录日志与操作日志
│   ├── api.ts
│   └── prisma.ts                          # Prisma Client 与连接池
├── generated/
│   └── prisma/                            # Prisma Client 输出目录
└── prisma/
    ├── schema.prisma
    └── migrations/
```

## 部署说明

本节按“单机生产部署”思路编写，适用于以下场景：

- Linux 服务器
- MySQL 8.4 独立部署或同机部署
- Next.js 以 Node.js 进程方式运行
- Nginx 负责反向代理与 HTTPS

如果你只是本地开发，可跳到“本地开发”章节。

### 推荐架构

推荐使用以下结构上线：

```text
Browser
  -> Nginx : 80/443
  -> Next.js App : 3000
  -> MySQL : 3306
```

推荐部署职责：

- `Nginx`：HTTPS、域名入口、反向代理、真实 IP 透传
- `Next.js`：应用运行与 SSR/API 服务
- `MySQL`：业务数据、会话、日志、权限数据存储
- `systemd`：托管 Node.js 进程，保证异常退出自动拉起

### 服务器要求

最低建议：

- 2 vCPU
- 4 GB 内存
- 40 GB SSD
- Ubuntu 22.04 LTS / Debian 12 / CentOS Stream 9
- Node.js 20 LTS
- MySQL 8.4
- Nginx 1.20+

中小型后台建议：

- 应用与数据库分机部署
- 数据库开启自动备份
- 生产环境使用 HTTPS
- 服务器时区统一为 `Asia/Shanghai`

### 部署目录建议

推荐目录：

```text
/opt/ai-coding/
├── current/              # 当前发布版本
├── shared/
│   ├── .env              # 生产环境变量
│   └── logs/             # 应用日志
└── releases/             # 历史发布版本
```

如果暂不做多版本发布，也可以直接使用简化目录：

```text
/opt/ai-coding/app
```

### 上线前准备

在服务器上安装运行依赖：

```bash
sudo apt update
sudo apt install -y nginx mysql-client
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

建议创建专用运行用户：

```bash
sudo useradd -r -s /usr/sbin/nologin ai-coding
sudo mkdir -p /opt/ai-coding/app
sudo chown -R $USER:$USER /opt/ai-coding
```

如果不希望创建新用户，也至少确保应用目录权限清晰，避免直接使用 `root` 跑 Node.js。

### 生产环境变量

复制 `.env.example` 为生产环境文件并修改：

```env
DATABASE_URL="mysql://root:PASSWORD@127.0.0.1:3306/ai_coding?allowPublicKeyRetrieval=true"
DATABASE_HOST="127.0.0.1"
DATABASE_PORT="3306"
DATABASE_USER="root"
DATABASE_PASSWORD="PASSWORD"
DATABASE_NAME="ai_coding"
NODE_ENV="production"
PORT="3000"
```

说明：

- `DATABASE_URL` 与拆分后的数据库配置应保持一致
- 如果数据库密码包含 `@`、`:`、`/` 等特殊字符，需要进行 URL 编码
- 当前 Prisma Client 通过 `@prisma/adapter-mariadb` 连接数据库，建议保留 `allowPublicKeyRetrieval=true`
- `PORT` 可按需调整，但需要与 Nginx 反向代理配置保持一致
- 不要把生产 `.env` 提交到仓库

### 数据库准备

#### 方式一：使用项目自带 Docker Compose 启动数据库

项目已提供 `docker-compose.yml`，适合单机快速部署数据库：

```bash
cp .env.example .env
docker compose up -d
```

#### 方式二：手动准备 MySQL 数据库

```sql
CREATE DATABASE ai_coding CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

如果使用 Docker 运行 MySQL：

```bash
docker run -d \
  --name ai-coding-mysql \
  -e MYSQL_ROOT_PASSWORD=PASSWORD \
  -p 3306:3306 \
  mysql:8.4
```

### 应用部署步骤

```bash
cd /opt/ai-coding/app
git clone https://github.com/loveai-ailove/AI-Admin-System.git .
cp .env.example .env
# 编辑 .env 为生产配置

npm install
npm run db:generate
npm run db:migrate
npm run build
sudo chown -R ai-coding:ai-coding /opt/ai-coding
```

首次手动启动验证：

```bash
NODE_ENV=production npm start
```

看到服务正常监听后，访问：

- 本机验证：`http://127.0.0.1:3000`
- 外网访问：先通过 Nginx 暴露域名或端口

### 回滚建议

如果更新后出现问题，建议按以下顺序处理：

1. 保留旧版本目录，不直接覆盖
2. 先回滚应用代码到上一个稳定版本
3. 如果数据库结构已经迁移，优先评估是否兼容旧代码
4. 数据库回滚前先备份

如果你准备做规范化发布，建议采用 `releases + current` 软链接模式，而不是直接在生产目录 `git pull`。

### 首次初始化

1. 打开登录页 `/login`
2. 当系统中没有任何后台账号时，页面会显示“初始化系统默认数据”按钮
3. 点击后自动创建默认部门、角色、菜单、权限和管理员账号
4. 使用以下默认账号登录

```text
用户名：admin
密码：Admin123!
```

首次登录后建议立即进入“个人中心”修改密码。

### 部署后检查清单

- 确认生产环境 `.env` 未泄漏到仓库
- 确认默认管理员密码已修改
- 确认域名已启用 HTTPS
- 确认数据库已开启定期备份
- 确认服务器防火墙仅放行业务需要的端口
- 确认日志与数据库磁盘容量有监控
- 确认 `admin_session` 在 HTTPS 场景下通过安全代理访问

## 本地开发

如果你的目标是参与日常开发，推荐先完成下面这套最小启动流程：

```bash
git clone https://github.com/loveai-ailove/AI-Admin-System.git
cd AI-Admin-System
cp .env.example .env
# 按实际环境修改数据库连接信息
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

启动后访问 [http://localhost:3000](http://localhost:3000)。

### 开发流程建议

- 第一次进入项目时，优先确认 `.env`、数据库连接和 Prisma Client 生成是否正常
- 启动后先访问 `/login`，在空库场景下执行“初始化系统默认数据”
- 开发页面时，优先检查对应的页面路由、接口路由、校验器与权限点是否齐全
- 新增系统管理能力时，通常需要同时修改菜单权限、接口权限、页面组件和数据模型
- 提交前至少执行 `npm run lint`，涉及数据结构变更时补充执行 `npm run db:migrate`

## 常用开发命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 执行生产构建，适合验证发布前状态
npm start            # 以生产模式启动应用
npm run lint         # 执行代码检查
npm run db:migrate   # 执行 Prisma 迁移
npm run db:generate  # 生成 Prisma Client
npm run db:push      # 将 Schema 推送到数据库
npm run db:studio    # 打开 Prisma Studio
```

## 开发协作建议

- 页面代码优先放在 `src/app` 与 `src/components`，避免把业务逻辑堆到页面文件
- 服务端认证、权限判断、日志记录等公共逻辑优先复用 `src/lib`
- 新增接口时同时补齐参数校验、权限校验和必要的日志记录
- 调整菜单、角色、按钮权限时，务必同步检查初始化数据与 RBAC 关联逻辑
- 涉及密码、Token、会话、日志字段时，默认按敏感信息处理，避免明文输出

## 运维说明

- 后端接口使用 Zod 做参数校验，非法请求会直接返回错误
- 日志状态当前复用 `Status` 枚举，`ACTIVE` 表示成功，`DISABLED` 表示失败
- 部门与菜单均为树形结构，删除或移动前需考虑父子关系约束
- 当前版本已具备日志查询与删除能力，但导出按钮权限仅完成初始化预置，尚未提供实际导出接口
- 修改本人密码或管理员重置密码后，相关用户会话会被清理，属于预期行为
- 登录日志与操作日志默认持续累积，生产环境建议定期归档或清理

## 后续可扩展方向

- 增加日志导出实现
- 增加更细粒度的数据权限范围
- 增加菜单图标规范与前端路由映射约定
- 增加批量操作、导入导出和更完整筛选能力
- 增加自动化测试、CI/CD 与部署脚本

## License

MIT
