Create Database Project

CREATE TABLE Users (
  Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  Email NVARCHAR(320) NOT NULL UNIQUE,
  PasswordHash NVARCHAR(500) NOT NULL,
  DisplayName NVARCHAR(200) NOT NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE Roles (
  Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  Name NVARCHAR(50) NOT NULL UNIQUE 
);

CREATE TABLE UserRole (
  UserId UNIQUEIDENTIFIER NOT NULL,
  RoleId UNIQUEIDENTIFIER NOT NULL,
  PRIMARY KEY (UserId, RoleId),
  CONSTRAINT FK_UserRole_User FOREIGN KEY (UserId) REFERENCES Users(Id),
  CONSTRAINT FK_UserRole_Role FOREIGN KEY (RoleId) REFERENCES Roles(Id)
);

CREATE TABLE Team (
  Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  Name NVARCHAR(200) NOT NULL UNIQUE,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE TeamMember (
  TeamId UNIQUEIDENTIFIER NOT NULL,
  UserId UNIQUEIDENTIFIER NOT NULL,
  TeamRole NVARCHAR(20) NOT NULL, 
  JoinedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  PRIMARY KEY (TeamId, UserId),
  CONSTRAINT FK_TeamMember_Team FOREIGN KEY (TeamId) REFERENCES Team(Id),
  CONSTRAINT FK_TeamMember_User FOREIGN KEY (UserId) REFERENCES Users(Id),
  CONSTRAINT CK_TeamMember_TeamRole CHECK (TeamRole IN ('TeamLeader','Member'))
);
--tasks--
CREATE TABLE Task (
  Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  TeamId UNIQUEIDENTIFIER NOT NULL,
  Title NVARCHAR(300) NOT NULL,
  Description1 NVARCHAR(MAX) NULL,
  AssignedUserId UNIQUEIDENTIFIER NULL,
  Priority1 NVARCHAR(20) NOT NULL,
  Complexity NVARCHAR(20) NOT NULL,
  EffortHours DECIMAL(10,2) NOT NULL,
  StartDate DATE NOT NULL,
  DueDate DATE NOT NULL,
  Status NVARCHAR(20) NOT NULL,
  CreatedByUserId UNIQUEIDENTIFIER NOT NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2 NULL,
  ClickUpTaskId NVARCHAR(50) NULL,     
  ClickUpListId NVARCHAR(50) NULL,    
  LastSyncedAt DATETIME2 NULL,        

  ---foreign keys--
  CONSTRAINT FK_Task_Team FOREIGN KEY (TeamId) REFERENCES [Team](Id),
  CONSTRAINT FK_Task_AssignedUser FOREIGN KEY (AssignedUserId) REFERENCES Users(Id),
  CONSTRAINT FK_Task_CreatedBy FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id),

  --checks--
  CONSTRAINT CK_Task_Priority CHECK (Priority1 IN ('Low','Medium','High','Critical')),
  CONSTRAINT CK_Task_Complexity CHECK (Complexity IN ('Simple','Medium','Complex')),
  CONSTRAINT CK_Task_Status CHECK (Status IN ('New','In Progress','Blocked','Done')),
  CONSTRAINT CK_Task_Dates CHECK (StartDate <= DueDate),
  CONSTRAINT CK_Task_Effort CHECK (EffortHours >= 0)
);

CREATE INDEX IX_Task_Team_DueDate ON [Task](TeamId, DueDate);
CREATE INDEX IX_Task_AssignedUser ON [Task](AssignedUserId);

-- weights + multplyr--
CREATE TABLE WeightMultiplier (
  Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  Category NVARCHAR(30) NOT NULL,  
  zKey NVARCHAR(30) NOT NULL,     
  Multiplier DECIMAL(10,4) NOT NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

  CONSTRAINT UX_WeightMultiplier UNIQUE (Category, zKey),
  CONSTRAINT CK_WeightMultiplier_Category CHECK (Category IN ('Priority','Complexity')),
  CONSTRAINT CK_WeightMultiplier_Value CHECK (Multiplier > 0));
  INSERT INTO [WeightMultiplier] (Id, Category, zKey, Multiplier) VALUES
(NEWID(),'Complexity','Simple',1.0),
(NEWID(),'Complexity','Medium',1.5),
(NEWID(),'Complexity','Complex',2.0),
(NEWID(),'Priority','Low',1.0),
(NEWID(),'Priority','Medium',1.2),
(NEWID(),'Priority','High',1.5),
(NEWID(),'Priority','Critical',2.0);

-- status history--
CREATE TABLE TaskStatusHistory (
  Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  TaskId UNIQUEIDENTIFIER NOT NULL,
  OldStatus NVARCHAR(20) NULL,
  NewStatus NVARCHAR(20) NOT NULL,
  ChangedByUserId UNIQUEIDENTIFIER NOT NULL,
  ChangedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

  CONSTRAINT FK_TaskStatusHistory_Task FOREIGN KEY (TaskId) REFERENCES [Task](Id),
  CONSTRAINT FK_TaskStatusHistory_ChangedBy FOREIGN KEY (ChangedByUserId) REFERENCES Users(Id),

  CONSTRAINT CK_TaskStatusHistory_Statuses CHECK (
    (OldStatus IS NULL OR OldStatus IN ('New','In Progress','Blocked','Done'))
    AND NewStatus IN ('New','In Progress','Blocked','Done')
  )
);

CREATE INDEX IX_TaskStatusHistory_Task_ChangedAt
  ON [TaskStatusHistory](TaskId, ChangedAt DESC);


