# 型定義リファクタリング：包括的プラン

## 現状分析
1. **54個の型定義**のうち**34個が未使用**（63%）
2. サービスは2つのパターンで実装：
   - `handle`: 20個のメソッド（単純なオブジェクトを返す）
   - `handleWithCustomFormat`: 8個のメソッド（直接MCPToolResultを返す）
3. 現在、サービスの戻り値に型定義がない

## フェーズ1: 不要な型の削除（即実施可能）

### 削除対象（34個の未使用型）
```typescript
// 完全に未使用の型
- SlackAPIResponse（基底インターフェース）
- 全Response型（17個）: ConversationHistoryResponse, ListChannelsResponse, etc.
- 未実装機能の型: AppConfiguration, ServerHealth, MessageSearchResult, etc.
- 重複定義: SearchThreadsInput（validation.tsに既存）
```

### 削除する具体的な型リスト
1. **Response型（17個）**:
   - SlackAPIResponse
   - ListChannelsResponse
   - ConversationHistoryResponse
   - UserInfoResponse
   - PostMessageResponse
   - ConversationRepliesResponse
   - FindThreadsResponse
   - ThreadAnalysisResponse
   - SearchThreadsResponse
   - ThreadMetricsResponse
   - FilesListResponse
   - FileInfoResponse
   - FileUploadResponse
   - ReactionAddResponse
   - ReactionGetResponse
   - WorkspaceInfoResponse
   - TeamMembersResponse

2. **設定・メタデータ型（7個）**:
   - AppConfiguration
   - ServerHealth
   - WorkspaceInfo
   - WorkspaceActivity
   - TeamMember

3. **検索・結果型（6個）**:
   - MessageSearchResult
   - FileSearchResult
   - ReactionSearchResult
   - ThreadSearchResult
   - SearchMatch
   - MessageReactions

4. **オプション・結果型（4個）**:
   - FileUploadOptions
   - ThreadExportOptions
   - ThreadExportResult
   - RelatedThread
   - ReactionDetails
   - ReactionStatistics
   - SearchThreadsInput（重複）

## フェーズ2: サービス出力型の新規定義

### 2.1 新しい型定義ファイル構造
```
src/slack/types/
├── index.ts          # 再エクスポート
├── core/            # 既存の基本型
│   ├── messages.ts  # SlackMessage, SlackAttachment等
│   ├── users.ts     # SlackUser, SlackUserProfile
│   ├── files.ts     # SlackFile, SlackFileComment等
│   └── threads.ts   # SlackThread, ThreadAnalysis等
└── outputs/         # 新規：サービス出力型
    ├── messages.ts  # メッセージ関連の出力型
    ├── threads.ts   # スレッド関連の出力型
    ├── files.ts     # ファイル関連の出力型
    └── reactions.ts # リアクション関連の出力型
```

### 2.2 出力型の定義例
```typescript
// src/slack/types/outputs/files.ts
export interface DeleteFileOutput {
  success: boolean;
  fileId: string;
  message: string;
}

export interface UploadFileOutput {
  file?: {
    id: string;
    name: string;
    url_private?: string;
    // ...
  };
  error?: string;
}

// src/slack/types/outputs/messages.ts
export interface ChannelHistoryOutput {
  messages: SlackMessage[];
  has_more: boolean;
  response_metadata?: {
    next_cursor?: string;
  };
}
```

## フェーズ3: RequestHandlerの型強化

### 3.1 handleメソッドの型改善
```typescript
// 現在（型推論が弱い）
handle<TInput, TOutput>(
  schema: ZodSchema<TInput>,
  args: unknown,
  operation: (input: TInput) => Promise<TOutput>
): Promise<MCPToolResult>

// 改善案（出力型を明示）
handle<TInput, TOutput extends Record<string, any>>(
  schema: ZodSchema<TInput>,
  args: unknown,
  operation: (input: TInput) => Promise<TOutput>
): Promise<MCPToolResult>
```

### 3.2 handleWithCustomFormatの型改善
```typescript
// 型付きMCPToolResultヘルパー
export function createTypedMCPResult<T>(data: T): MCPToolResult {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2)
    }]
  };
}

// 使用例
async (input) => {
  const data: ChannelHistoryOutput = {
    messages: messages,
    has_more: hasMore,
    response_metadata: { next_cursor }
  };
  return createTypedMCPResult(data);
}
```

## フェーズ4: サービス実装の更新

### 優先順位（複雑さと使用頻度で選定）
1. **最優先（ページネーション対応）**:
   - getChannelHistory
   - getThreadReplies
   - findThreadsInChannel
   - listFiles

2. **高優先（複雑な出力）**:
   - analyzeThread
   - summarizeThread
   - extractActionItems

3. **中優先（単純な出力）**:
   - deleteFile
   - addReaction
   - sendMessage

## 実装手順

### Week 1: 不要な型を削除
- [ ] 未使用型のリストアップ確認
- [ ] 依存関係の最終チェック
- [ ] 34個の未使用型を削除
- [ ] テスト実行とエラー修正

### Week 2: 出力型を定義
- [ ] outputs/ディレクトリ構造作成
- [ ] 基本型をcore/ディレクトリに移動
- [ ] サービス出力型を定義
- [ ] index.tsでの再エクスポート設定

### Week 3: RequestHandlerとヘルパー関数の改善
- [ ] handleメソッドの型改善
- [ ] createTypedMCPResultヘルパー作成
- [ ] 型検証の追加

### Week 4: 優先度の高いサービスから型を適用
- [ ] ページネーション対応サービスの型適用
- [ ] 複雑な出力を持つサービスの型適用
- [ ] 単純な出力サービスの型適用

## TDD実装サイクル

各フェーズで以下のサイクルを実行：

### Red（テスト失敗）
1. 型定義を削除/追加してコンパイルエラーを発生させる
2. 新しい型を使用するテストを作成

### Green（テスト成功）
1. 最小限の実装で型エラーを解決
2. すべてのテストが通ることを確認

### Refactor（リファクタリング）
1. コードの品質向上
2. 型安全性の強化
3. パフォーマンス最適化

## 検証方法
1. 既存テストがすべてパス
2. `npm run typecheck`でエラーなし
3. `npm run lint`でエラーなし
4. 新しい型定義のテストカバレッジ確保

## 成果物
- 型定義ファイルの60%削減
- サービス出力の型安全性確保
- 開発効率の向上
- ドキュメント性の向上

## リスク管理
- 各フェーズでバックアップを作成
- 段階的コミット
- 破壊的変更の回避
- チームレビューの実施