; manic.pmd  —  PMD-85  Intel 8080 disassembly
; org $7EDF   size 289 bytes

        ORG  $7EDF

7EDF:  F3        DI
7EE0:  2A 10 00  LHLD $0010
7EE3:  23        INX H
7EE4:  22 10 00  SHLD $0010
7EE7:  31 57 7C  LXI SP,$7C57
7EEA:  CD 54 7F  CALL $7F54
7EED:  21 18 E0  LXI H,$E018
7EF0:  7E        MOV A,M
7EF1:  EE 3F     XRI $3F
7EF3:  77        MOV M,A
7EF4:  0E 00     MVI C,$00
7EF6:  CD 13 7F  CALL $7F13
7EF9:  6F        MOV L,A
7EFA:  CD 13 7F  CALL $7F13
7EFD:  67        MOV H,A
7EFE:  CD 13 7F  CALL $7F13
7F01:  77        MOV M,A
7F02:  2C        INR L
7F03:  C2 FE 7E  JNZ $7EFE
7F06:  CD 1B 7F  CALL $7F1B
7F09:  B9        CMP C
7F0A:  C2 00 80  JNZ $8000
7F0D:  24        INR H
7F0E:  F2 ED 7E  JP $7EED
7F11:  C7        RST 0
7F12:  01 CD 1B  LXI B,$1BCD
7F15:  7F        MOV A,A
7F16:  F5        PUSH PSW
7F17:  A9        XRA C
7F18:  4F        MOV C,A
7F19:  F1        POP PSW
7F1A:  C9        RET
7F1B:  CD 79 7F  CALL $7F79
7F1E:  D8        RC
7F1F:  DB 1F     IN $1F
7F21:  E6 02     ANI $02
7F23:  CA 1B 7F  JZ $7F1B
7F26:  DB 1E     IN $1E
7F28:  C9        RET
7F29:  F5        PUSH PSW
7F2A:  CD 79 7F  CALL $7F79
7F2D:  DA 3C 7F  JC $7F3C
7F30:  DB 1F     IN $1F
7F32:  E6 01     ANI $01
7F34:  CA 2A 7F  JZ $7F2A
7F37:  F1        POP PSW
7F38:  D3 1E     OUT $1E
7F3A:  B7        ORA A
7F3B:  C9        RET
7F3C:  F1        POP PSW
7F3D:  37        STC
7F3E:  C9        RET
7F3F:  C5        PUSH B
7F40:  01 F4 01  LXI B,$01F4
7F43:  3E FF     MVI A,$FF
7F45:  CD 29 7F  CALL $7F29
7F48:  0B        DCX B
7F49:  78        MOV A,B
7F4A:  B1        ORA C
7F4B:  C2 43 7F  JNZ $7F43
7F4E:  C1        POP B
7F4F:  3E A5     MVI A,$A5
7F51:  C3 29 7F  JMP $7F29
7F54:  C5        PUSH B
7F55:  06 32     MVI B,$32
7F57:  CD 1B 7F  CALL $7F1B
7F5A:  DA 77 7F  JC $7F77
7F5D:  FE FF     CPI $FF
7F5F:  C2 55 7F  JNZ $7F55
7F62:  05        DCR B
7F63:  C2 57 7F  JNZ $7F57
7F66:  CD 1B 7F  CALL $7F1B
7F69:  DA 77 7F  JC $7F77
7F6C:  FE FF     CPI $FF
7F6E:  CA 66 7F  JZ $7F66
7F71:  FE A5     CPI $A5
7F73:  C2 55 7F  JNZ $7F55
7F76:  B7        ORA A
7F77:  C1        POP B
7F78:  C9        RET
7F79:  CD 74 8C  CALL $8C74
7F7C:  C0        RNZ
7F7D:  37        STC
7F7E:  C9        RET
7F7F:  00        NOP
7F80:  00        NOP
7F81:  00        NOP
7F82:  00        NOP
7F83:  00        NOP
7F84:  00        NOP
7F85:  00        NOP
7F86:  00        NOP
7F87:  00        NOP
7F88:  00        NOP
7F89:  00        NOP
7F8A:  00        NOP
7F8B:  00        NOP
7F8C:  00        NOP
7F8D:  00        NOP
7F8E:  00        NOP
7F8F:  00        NOP
7F90:  00        NOP
7F91:  00        NOP
7F92:  00        NOP
7F93:  00        NOP
7F94:  00        NOP
7F95:  00        NOP
7F96:  00        NOP
7F97:  00        NOP
7F98:  00        NOP
7F99:  00        NOP
7F9A:  00        NOP
7F9B:  00        NOP
7F9C:  00        NOP
7F9D:  00        NOP
7F9E:  00        NOP
7F9F:  00        NOP
7FA0:  00        NOP
7FA1:  00        NOP
7FA2:  00        NOP
7FA3:  00        NOP
7FA4:  00        NOP
7FA5:  00        NOP
7FA6:  00        NOP
7FA7:  00        NOP
7FA8:  00        NOP
7FA9:  00        NOP
7FAA:  00        NOP
7FAB:  00        NOP
7FAC:  00        NOP
7FAD:  00        NOP
7FAE:  00        NOP
7FAF:  00        NOP
7FB0:  00        NOP
7FB1:  00        NOP
7FB2:  00        NOP
7FB3:  00        NOP
7FB4:  00        NOP
7FB5:  00        NOP
7FB6:  00        NOP
7FB7:  00        NOP
7FB8:  00        NOP
7FB9:  00        NOP
7FBA:  00        NOP
7FBB:  00        NOP
7FBC:  00        NOP
7FBD:  00        NOP
7FBE:  00        NOP
7FBF:  00        NOP
7FC0:  00        NOP
7FC1:  00        NOP
7FC2:  00        NOP
7FC3:  00        NOP
7FC4:  00        NOP
7FC5:  00        NOP
7FC6:  00        NOP
7FC7:  00        NOP
7FC8:  00        NOP
7FC9:  00        NOP
7FCA:  00        NOP
7FCB:  00        NOP
7FCC:  00        NOP
7FCD:  00        NOP
7FCE:  00        NOP
7FCF:  00        NOP
7FD0:  00        NOP
7FD1:  00        NOP
7FD2:  00        NOP
7FD3:  00        NOP
7FD4:  00        NOP
7FD5:  00        NOP
7FD6:  00        NOP
7FD7:  00        NOP
7FD8:  00        NOP
7FD9:  00        NOP
7FDA:  00        NOP
7FDB:  00        NOP
7FDC:  00        NOP
7FDD:  00        NOP
7FDE:  00        NOP
7FDF:  00        NOP
7FE0:  00        NOP
7FE1:  00        NOP
7FE2:  00        NOP
7FE3:  00        NOP
7FE4:  00        NOP
7FE5:  00        NOP
7FE6:  00        NOP
7FE7:  00        NOP
7FE8:  00        NOP
7FE9:  00        NOP
7FEA:  00        NOP
7FEB:  00        NOP
7FEC:  00        NOP
7FED:  00        NOP
7FEE:  00        NOP
7FEF:  D4 04 CD  CNC $CD04
7FF2:  04        INR B
7FF3:  08        -
7FF4:  02        STAX B
7FF5:  80        ADD B
7FF6:  7F        MOV A,A
7FF7:  85        ADD L
7FF8:  04        INR B
7FF9:  A2        ANA D
7FFA:  04        INR B
7FFB:  DF        RST 3
7FFC:  7E        MOV A,M
7FFD:  DF        RST 3
7FFE:  7E        MOV A,M
7FFF:  00        NOP
