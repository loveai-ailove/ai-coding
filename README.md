# AI Coding

基于 **Next.js 16 + React 19 + Prisma 7 + MySQL 8.4** 构建的后台管理系统示例，当前版本已包含登录鉴权、会话管理、RBAC 权限控制，以及用户、角色、菜单、部门等系统管理能力。

## 项目概览

当前版本不再是简单的用户 CRUD，而是一个完整的管理后台骨架，适合作为中后台系统或权限平台的起点。

核心能力包括：

- 登录 / 退出登录
- 基于 Cookie Session 的会话管理
- 首次启动一键初始化系统默认数据
- 超级管理员与权限点校验
- 动态侧边栏菜单
- 工作台统计面板
- 系统用户管理
- 系统角色管理
- 系统菜单管理
- 系统部门管理
- 个人资料维护
- 修改当前登录用户密码

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| [Next.js](https://nextjs.org/) | 16 | React 全栈框架，使用 App Router |
| [React](https://react.dev/) | 19 | 前端 UI 渲染 |
| [Prisma](https://www.prisma.io/) | 7 | ORM 与数据库访问 |
| [MySQL](https://www.mysql.com/) | 8.4 | 关系型数据库 |
| [TypeScript](https://www.typescriptlang.org/) | 5 | 类型安全 |
| [Tailwind CSS](https://tailwindcss.com/) | 4 | 界面样式 |
| [Zod](https://zod.dev/) | 4 | 接口参数校验 |
| [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | 3 | 密码哈希 |

## 功能说明

### 1. 认证与权限

- 首页根据登录态自动跳转到 `/login` 或 `/admin`
- 使用 `admin_session` Cookie 维护登录会话
- 通过页面权限和按钮权限实现 RBAC 控制
- 未登录访问 `/admin` 会自动重定向到登录页
- 首次无账号时可在登录页直接初始化默认管理员与基础权限数据

### 2. 后台模块

- 工作台：展示用户、角色、菜单、部门数量统计
- 用户管理：新增、编辑、删除系统用户，支持分配角色与部门
- 角色管理：维护角色信息并分配菜单权限
- 菜单管理：维护目录、菜单、按钮三类资源
- 部门管理：维护树形部门结构
- 个人中心：修改昵称、邮箱、手机号、备注与密码

### 3. 初始化默认数据

首次执行初始化时，系统会自动创建：

- 根部门：`总部`
- 默认角色：`超级管理员`
- 默认用户：`admin`
- 默认密码：`Admin123!`
- 默认菜单：
  - 工作台
  - 系统管理
  - 用户管理
  - 角色管理
  - 菜单管理
  - 部门管理
- 默认按钮权限：
  - `system:user:create`
  - `system:user:update`
  - `system:user:delete`
  - `system:role:create`
  - `system:role:update`
  - `system:role:delete`
  - `system:menu:create`
  - `system:menu:update`
  - `system:menu:delete`
  - `system:dept:create`
  - `system:dept:update`
  - `system:dept:delete`

## 数据模型

Prisma Schema 当前包含以下核心实体：

- `SysUser`：系统用户
- `SysRole`：系统角色
- `SysMenu`：系统菜单 / 权限资源
- `SysDept`：系统部门
- `SysUserRole`：用户与角色关联表
- `SysRoleMenu`：角色与菜单关联表
- `SysUserSession`：用户会话表

其中菜单类型支持：

- `DIRECTORY`：目录
- `MENU`：页面菜单
- `BUTTON`：按钮权限

## 页面路由

| 路径 | 说明 |
|------|------|
| `/login` | 登录页，首次可执行系统初始化 |
| `/admin` | 工作台 |
| `/admin/system/users` | 用户管理 |
| `/admin/system/roles` | 角色管理 |
| `/admin/system/menus` | 菜单管理 |
| `/admin/system/depts` | 部门管理 |
| `/admin/profile` | 个人中心 |

## API 接口

### 认证相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/logout` | 退出登录 |
| POST | `/api/auth/bootstrap` | 初始化系统默认数据 |
| GET | `/api/auth/me` | 获取当前登录用户信息 |
| GET | `/api/auth/profile` | 获取个人资料 |
| PUT | `/api/auth/profile` | 更新个人资料 |
| POST | `/api/auth/change-password` | 修改当前用户密码 |

### 系统管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/system/users` | 获取用户列表 |
| POST | `/api/admin/system/users` | 创建用户 |
| GET | `/api/admin/system/users/:id` | 获取用户详情 |
| PUT | `/api/admin/system/users/:id` | 更新用户 |
| DELETE | `/api/admin/system/users/:id` | 删除用户 |
| POST | `/api/admin/system/users/:id/reset-password` | 重置用户密码 |
| GET | `/api/admin/system/roles` | 获取角色列表 |
| POST | `/api/admin/system/roles` | 创建角色 |
| GET | `/api/admin/system/roles/:id` | 获取角色详情 |
| PUT | `/api/admin/system/roles/:id` | 更新角色 |
| DELETE | `/api/admin/system/roles/:id` | 删除角色 |
| GET | `/api/admin/system/menus` | 获取菜单列表 |
| POST | `/api/admin/system/menus` | 创建菜单 |
| GET | `/api/admin/system/menus/:id` | 获取菜单详情 |
| PUT | `/api/admin/system/menus/:id` | 更新菜单 |
| DELETE | `/api/admin/system/menus/:id` | 删除菜单 |
| GET | `/api/admin/system/depts` | 获取部门列表 |
| POST | `/api/admin/system/depts` | 创建部门 |
| GET | `/api/admin/system/depts/:id` | 获取部门详情 |
| PUT | `/api/admin/system/depts/:id` | 更新部门 |
| DELETE | `/api/admin/system/depts/:id` | 删除部门 |

## 项目结构

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
│   │       └── system/
│   │           ├── page.tsx               # 系统管理默认跳转
│   │           ├── users/page.tsx         # 用户管理
│   │           ├── roles/page.tsx         # 角色管理
│   │           ├── menus/page.tsx         # 菜单管理
│   │           └── depts/page.tsx         # 部门管理
│   ├── api/
│   │   ├── auth/                          # 认证与个人中心接口
│   │   └── admin/system/                  # 系统管理接口
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                           # 根路由，根据登录态跳转
├── components/
│   ├── admin/                             # 后台头部、侧边栏、面包屑
│   ├── auth/                              # 登录表单
│   ├── profile/                           # 个人中心
│   ├── system/                            # 用户、角色、菜单、部门管理组件
│   └── ui/                                # 通用 UI 组件
├── lib/
│   ├── auth/                              # 登录态、权限、密码、当前用户
│   ├── system/                            # 初始化与树结构处理
│   ├── validators/                        # Zod 校验
│   ├── api.ts
│   └── prisma.ts
├── generated/
│   └── prisma/                            # Prisma Client 输出目录
└── types/
    ├── auth.ts
    └── system.ts

prisma/
├── schema.prisma
└── migrations/
```

## 快速开始

### 前置条件

- Node.js 18+
- MySQL 8.4+

可用 Docker 启动本地 MySQL：

```bash
docker run -d \
  --name mysql \
  -e MYSQL_ROOT_PASSWORD=your_password \
  -p 3306:3306 \
  mysql:8.4
```

### 安装与运行

```bash
git clone <your-repository-url>
cd ai-coding

cp .env.example .env
# 按实际环境修改数据库连接信息

npm install
npm run db:migrate
npm run dev
```

启动后访问 [http://localhost:3000](http://localhost:3000)。

### 首次初始化

1. 打开登录页 `/login`
2. 当系统中没有任何后台账号时，页面会显示“初始化系统默认数据”按钮
3. 点击后自动创建默认部门、角色、菜单、权限和管理员账号
4. 使用以下默认账号登录：

```text
用户名：admin
密码：Admin123!
```

首次登录后建议立即在个人中心修改密码。

## 环境变量

复制 `.env.example` 为 `.env` 并修改：

```env
DATABASE_URL="mysql://root:PASSWORD@localhost:3306/ai_coding"
DATABASE_HOST="localhost"
DATABASE_PORT="3306"
DATABASE_USER="root"
DATABASE_PASSWORD="PASSWORD"
DATABASE_NAME="ai_coding"
```

注意事项：

- `DATABASE_URL` 需要与实际数据库账号、密码、库名保持一致
- 如果密码包含特殊字符，例如 `@`，需要做 URL 编码，例如 `%40`

## 可用命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 生产构建
npm start            # 启动生产服务器
npm run lint         # 代码检查
npm run db:migrate   # 执行 Prisma 迁移
npm run db:generate  # 生成 Prisma Client
npm run db:push      # 将 Schema 推送到数据库
npm run db:studio    # 打开 Prisma Studio
```

## 后续可扩展方向

- 增加操作日志、登录日志
- 增加角色数据权限范围
- 增加菜单图标与前端路由映射规范
- 增加分页、筛选、批量操作
- 对接更完整的前端组件库
- 增加自动化测试与部署脚本

## License

MIT
