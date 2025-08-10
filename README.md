# Slack MCP Server

⚠️ **重要な注意事項**: このプロジェクトはまだ十分にテストされていません。本番環境での使用には注意が必要で、予期しない不具合が発生する可能性があります。使用する際は十分な検証を行ってください。

このSlack MCP (Model Context Protocol) サーバーは、Slack APIの機能を網羅的に実装し、ファイル操作、リアクション管理、スレッド分析など、40個のツールを提供します。

## 🚀 クイックスタート

### 必要なトークンの準備

このサーバーを使用するには、最低限**ボットトークン**が必要です：

- **ボットトークン** (`xoxb-*`): Slack Appから取得。基本的な読み書き操作に必要
- **ユーザートークン** (`xoxp-*`): オプション。検索機能を使いたい場合に必要

### MCP設定

MCP互換クライアントでの設定例を用途別に紹介します。

#### 設定例

##### 1. 基本設定（ボットトークンのみ）
メッセージの送受信、ファイルアップロード、リアクション管理など基本機能が使用可能

```json
{
  "mcpServers": {
    "slack": {
      "command": "npx",
      "args": ["github:yhosok/slack-mcp-server"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-token-here"
      }
    }
  }
}
```

##### 2. 検索機能付き設定（ボット + ユーザートークン）
基本機能に加えて、メッセージ検索、スレッド検索、ファイル検索が使用可能

```json
{
  "mcpServers": {
    "slack": {
      "command": "npx",
      "args": ["github:yhosok/slack-mcp-server"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-token-here",
        "SLACK_USER_TOKEN": "xoxp-your-user-token",
        "USE_USER_TOKEN_FOR_READ": "true"
      }
    }
  }
}
```

##### 3. ローカルインストール版

```json
{
  "mcpServers": {
    "slack": {
      "command": "node",
      "args": ["./path/to/slack-mcp-server/dist/index.js"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-token-here",
        "SLACK_USER_TOKEN": "xoxp-your-user-token",
        "USE_USER_TOKEN_FOR_READ": "true"
      }
    }
  }
}
```

**設定のポイント**: 
- 初回実行時はTypeScriptのコンパイルのため時間がかかる場合があります
- 検索機能を使う場合は `USE_USER_TOKEN_FOR_READ` を `true` に設定し、ユーザートークンも必要です
- どの設定を選ぶかは「必要な機能」と「セキュリティ要件」のバランスで決めてください

### ローカル開発
```bash
# クローンとセットアップ
git clone https://github.com/yourusername/slack-mcp-server.git
cd slack-mcp-server
./setup.sh

# ビルドと実行
npm run build
npm start
```

## ⚙️ 設定

### 環境変数

サーバーは以下の環境変数をサポートしています：

| 変数 | 必須 | デフォルト | 説明 |
|----------|----------|---------|-------------|
| `SLACK_BOT_TOKEN` | ✅ 必須 | - | Slack Appのボットトークン (xoxb-*) |
| `SLACK_USER_TOKEN` | ❌ 任意 | - | 拡張機能用のユーザートークン (xoxp-*) |
| `USE_USER_TOKEN_FOR_READ` | ❌ 任意 | `false` | 読み取り操作でユーザートークンを使用 |
| `LOG_LEVEL` | ❌ 任意 | `info` | ログレベル (debug, info, warn, error) |

### トークンの使い分けガイド

このサーバーは2種類のトークンを使い分けることで、セキュリティと機能のバランスを取ります：

#### ボットトークンのみ（推奨）
- **利点**: セキュアで権限管理が明確
- **制限**: 検索機能は使用不可
- **用途**: 通常のチャンネル操作、メッセージ送信、ファイル管理

#### ボット + ユーザートークン
- **利点**: 全機能が使用可能（検索を含む）
- **注意**: ユーザートークンは強力な権限を持つため取り扱い注意
- **用途**: 検索機能が必要な高度な自動化

### 必要なボットトークンスコープ

ボットのみモードでは、Slack Appに以下のOAuthスコープが必要です：
- `channels:read` - チャンネル情報の読み取り
- `channels:history` - チャンネルメッセージの読み取り
- `groups:read` - プライベートチャンネルの読み取り
- `groups:history` - プライベートチャンネルメッセージの読み取り
- `users:read` - ユーザー情報の読み取り
- `team:read` - ワークスペース情報の読み取り
- `files:read` - ファイル情報の読み取り
- `files:write` - ファイルのアップロードと管理
- `chat:write` - メッセージの送信
- `reactions:read` - リアクションの読み取り
- `reactions:write` - リアクションの追加/削除

### 必要なユーザートークンスコープ

検索機能を使用する場合：
- `search:read` - メッセージとファイルの検索

## 📋 完全なツールリスト（全40ツール）

### コアメッセージング（6ツール）
- `send_message` - チャンネル/スレッドへのメッセージ送信
- `list_channels` - ワークスペースチャンネル一覧
- `get_channel_history` - チャンネルメッセージ履歴の取得
- `get_user_info` - ユーザー情報の取得
- `search_messages` - メッセージ検索（ユーザートークン必要）
- `get_channel_info` - チャンネル詳細情報の取得

### スレッド管理（14ツール）
- `find_threads_in_channel` - チャンネル内のすべてのスレッド検索
- `get_thread_replies` - スレッドの完全な内容取得
- `search_threads` - キーワード/参加者によるスレッド検索
- `analyze_thread` - スレッド分析（参加者、タイムライン、トピック）
- `summarize_thread` - スレッドサマリー生成（パターンマッチング方式）
- `post_thread_reply` - 既存スレッドへの返信
- `create_thread` - 新規スレッドの作成
- `mark_thread_important` - 重要スレッドのマーク
- `extract_action_items` - スレッドからのタスク抽出
- `identify_important_threads` - 重要度の高いディスカッションの特定
- `export_thread` - スレッドのエクスポート（markdown、JSON、HTML、CSV）
- `find_related_threads` - 関連ディスカッションの発見
- `get_thread_metrics` - スレッド分析と統計
- `get_threads_by_participants` - ユーザー参加によるスレッド検索

### ファイル操作（7ツール）
- `upload_file` - メタデータ付きファイルアップロード
- `list_files` - フィルター付きワークスペースファイル一覧
- `get_file_info` - 詳細なファイル情報
- `delete_file` - ファイル削除（権限がある場合）
- `share_file` - 追加チャンネルへのファイル共有
- `analyze_files` - ファイル使用分析とクリーンアップ洞察
- `search_files` - 高度なファイル検索機能

### リアクション管理（5ツール）
- `add_reaction` - メッセージへの絵文字リアクション追加
- `remove_reaction` - メッセージからのリアクション削除
- `get_reactions` - メッセージ上のすべてのリアクション一覧
- `get_reaction_statistics` - リアクション分析とトレンド
- `find_messages_by_reactions` - リアクションパターンによるメッセージ検索

### ワークスペース管理（4ツール）
- `get_workspace_info` - ワークスペース/チーム情報
- `list_team_members` - 役割付きチームメンバー一覧
- `get_workspace_activity` - 包括的なアクティビティレポート
- `get_server_health` - サーバーヘルスとパフォーマンス監視

## 🛠️ 技術的実装

### アーキテクチャ
- **完全な型安全設計**: 
  - すべてのSlack APIエンティティの包括的なTypeScript型定義
  - プロダクションコードでの`any`型の排除
  - `@slack/web-api`からの型インポートによる型安全なAPI呼び出し
  - Slack APIレスポンスと内部型の変換ユーティリティ
- **バリデーション層**: すべての操作にZodベースの入力検証
- **エラーハンドリング**: 詳細なログ記録による堅牢なエラー処理
- **パフォーマンス**: 大規模ワークスペース操作に最適化

### 高度な機能
- **バイナリファイルサポート**: 適切なバイナリデータ処理によるファイルアップロード
- **マルチフォーマットエクスポート**: markdown、JSON、HTML、CSVエクスポートのサポート
- **クロスチャンネル操作**: 複数のチャンネルとワークスペースでの作業
- **パターンマッチング分析**: キーワードベースのスレッド分析（AI/NLPは使用せず）
- **型安全なテスト**: Jest with ES modulesによる型安全なテスト環境

### 統合機能
- **MCPプロトコル**: 完全なModel Context Protocolコンプライアンス
- **権限処理**: Slackの権限とアクセス制御の尊重
- **トークン戦略**: ボット/ユーザートークンの柔軟な使い分け

## 🎯 使用例

この実装により可能になること：

1. **チーム通信分析**: チームのコミュニケーションパターンの深い洞察
2. **コンテンツ管理**: ワークスペースファイルとドキュメントの整理と管理
3. **ワークフロー自動化**: 定型的なSlack操作とメンテナンスの自動化
4. **コンプライアンスと監査**: コンプライアンス要件のレポート生成
5. **生産性分析**: チームの生産性の測定と最適化
6. **ナレッジ管理**: 組織知識の抽出と整理
7. **統合ハブ**: Slackと外部システム/ワークフローの接続

## 🚀 開発を始める

```bash
# 依存関係のインストール
npm install

# プロジェクトのビルド
npm run build

# サーバーの起動
npm start

# 開発モード（ホットリロード付き）
npm run dev

# テストの実行
npm test

# 型チェック
npm run build

# リント
npm run lint

# コードフォーマット
npm run format
```

## 📊 パフォーマンスとスケーラビリティ

- **非同期処理**: Slack APIの非同期呼び出しをサポート
- **メモリ効率**: 大規模データセットの効率的な処理
- **エラーハンドリング**: 堅牢なエラー処理と詳細なログ出力
- **レート制限**: 現在は実装されていません（将来の改善点）

## ⚠️ 既知の制限事項

1. **検索API依存性**: 検索操作（`searchMessages`、`searchThreads`、`searchFiles`）にはユーザートークンが必要
2. **スレッド分析**: 基本的なパターンマッチング（AI/NLPではない）
3. **レート制限**: レート制限の実装なし
4. **対話的操作**: `-i`フラグ付きgitコマンドなどはサポートされていません

## 🔧 開発者向け情報

### プロジェクト構造
```
src/
├── __tests__/          # Jestテストファイル（3つのテストスイート）
├── config/             # 設定管理（Zodベースの環境変数検証）
├── index.ts            # MCPサーバーエントリポイント
├── mcp/                # MCPプロトコル定義
│   ├── tools.ts        # ツール定義（40ツール）
│   └── types.ts        # MCP TypeScript型
├── slack/              # Slack統合
│   ├── slack-service.ts # コアサービス実装（3000行以上）
│   └── types.ts        # Slack固有の型定義
└── utils/              # ユーティリティ
    ├── errors.ts       # カスタムエラークラス
    ├── helpers.ts      # ヘルパー関数
    ├── logger.ts       # ログユーティリティ
    └── validation.ts   # Zodバリデーションスキーマ
```

### 新しいツールの追加方法

1. `src/mcp/tools.ts`にツールスキーマを定義
2. `ALL_TOOLS`エクスポートに追加
3. `src/utils/validation.ts`にバリデーションスキーマを追加
4. `src/slack/slack-service.ts`にメソッドを実装
5. `src/index.ts`のswitchステートメントにケースを追加
6. 必要に応じて`src/slack/types.ts`に型を追加
7. `src/__tests__/`にテストを作成

## 📝 ライセンスと貢献

このプロジェクトへの貢献を歓迎します。プルリクエストを送信する前に、テストが通ることを確認してください。

---

⚠️ **再度の注意**: このプロジェクトは開発中であり、本番環境での使用には十分な検証が必要です。不具合や予期しない動作が発生する可能性があります。