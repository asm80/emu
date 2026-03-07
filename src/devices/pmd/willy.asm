; willy.pmd  —  PMD-85  Intel 8080 disassembly
; org $7D6C   size 654 bytes

        ORG  $7D6C

7D6C:  C2 44 7E  JNZ $7E44
7D6F:  AF        XRA A
7D70:  32 FF FF  STA $FFFF
7D73:  32 71 C1  STA $C171
7D76:  31 6C 7D  LXI SP,$7D6C
7D79:  3E C3     MVI A,$C3
7D7B:  32 FD C1  STA $C1FD
7D7E:  21 31 7E  LXI H,$7E31
7D81:  22 FE C1  SHLD $C1FE
7D84:  CD D3 7D  CALL $7DD3
7D87:  6F        MOV L,A
7D88:  CD D3 7D  CALL $7DD3
7D8B:  67        MOV H,A
7D8C:  CD D3 7D  CALL $7DD3
7D8F:  22 F0 FF  SHLD $FFF0
7D92:  6F        MOV L,A
7D93:  CD D3 7D  CALL $7DD3
7D96:  67        MOV H,A
7D97:  22 F2 FF  SHLD $FFF2
7D9A:  CD D3 7D  CALL $7DD3
7D9D:  6F        MOV L,A
7D9E:  CD D3 7D  CALL $7DD3
7DA1:  67        MOV H,A
7DA2:  22 F4 FF  SHLD $FFF4
7DA5:  3E B0     MVI A,$B0
7DA7:  32 FA C1  STA $C1FA
7DAA:  CD 7D 7E  CALL $7E7D
7DAD:  21 E7 7E  LXI H,$7EE7
7DB0:  CD 4B 7E  CALL $7E4B
7DB3:  11 B1 7E  LXI D,$7EB1
7DB6:  CD 93 7E  CALL $7E93
7DB9:  21 57 7F  LXI H,$7F57
7DBC:  CD 4B 7E  CALL $7E4B
7DBF:  11 CB 7E  LXI D,$7ECB
7DC2:  CD 93 7E  CALL $7E93
7DC5:  3E A8     MVI A,$A8
7DC7:  32 FA C1  STA $C1FA
7DCA:  21 4B 7F  LXI H,$7F4B
7DCD:  CD 4B 7E  CALL $7E4B
7DD0:  C3 CA 7D  JMP $7DCA
7DD3:  00        NOP
7DD4:  CD 0E 8E  CALL $8E0E
7DD7:  DB 1E     IN $1E
7DD9:  F5        PUSH PSW
7DDA:  C5        PUSH B
7DDB:  47        MOV B,A
7DDC:  3A FF FF  LDA $FFFF
7DDF:  80        ADD B
7DE0:  32 FF FF  STA $FFFF
7DE3:  C1        POP B
7DE4:  F1        POP PSW
7DE5:  C9        RET
7DE6:  E5        PUSH H
7DE7:  C5        PUSH B
7DE8:  2A F0 FF  LHLD $FFF0
7DEB:  DB 1E     IN $1E
7DED:  77        MOV M,A
7DEE:  47        MOV B,A
7DEF:  3A FF FF  LDA $FFFF
7DF2:  80        ADD B
7DF3:  32 FF FF  STA $FFFF
7DF6:  23        INX H
7DF7:  7C        MOV A,H
7DF8:  FE 46     CPI $46
7DFA:  C2 FF 7D  JNZ $7DFF
7DFD:  26 70     MVI H,$70
7DFF:  22 F0 FF  SHLD $FFF0
7E02:  2A 3E C0  LHLD $C03E
7E05:  E5        PUSH H
7E06:  21 25 D0  LXI H,$D025
7E09:  22 3E C0  SHLD $C03E
7E0C:  2A F2 FF  LHLD $FFF2
7E0F:  2B        DCX H
7E10:  7C        MOV A,H
7E11:  CD 25 81  CALL $8125
7E14:  7D        MOV A,L
7E15:  CD 25 81  CALL $8125
7E18:  7C        MOV A,H
7E19:  B5        ORA L
7E1A:  22 F2 FF  SHLD $FFF2
7E1D:  E1        POP H
7E1E:  22 3E C0  SHLD $C03E
7E21:  CA 36 7E  JZ $7E36
7E24:  C1        POP B
7E25:  E1        POP H
7E26:  3E F5     MVI A,$F5
7E28:  DB 1F     IN $1F
7E2A:  E6 02     ANI $02
7E2C:  C2 E6 7D  JNZ $7DE6
7E2F:  F1        POP PSW
7E30:  C9        RET
7E31:  D1        POP D
7E32:  E1        POP H
7E33:  C3 27 7E  JMP $7E27
7E36:  2A F4 FF  LHLD $FFF4
7E39:  3A FF FF  LDA $FFFF
7E3C:  47        MOV B,A
7E3D:  CD D3 7D  CALL $7DD3
7E40:  B8        CMP B
7E41:  CA 4D 80  JZ $804D
7E44:  3E 40     MVI A,$40
7E46:  D3 1F     OUT $1F
7E48:  C3 00 80  JMP $8000
7E4B:  46        MOV B,M
7E4C:  23        INX H
7E4D:  4E        MOV C,M
7E4E:  23        INX H
7E4F:  7E        MOV A,M
7E50:  87        ADD A
7E51:  32 70 C1  STA $C170
7E54:  23        INX H
7E55:  7E        MOV A,M
7E56:  87        ADD A
7E57:  32 72 C1  STA $C172
7E5A:  23        INX H
7E5B:  7E        MOV A,M
7E5C:  87        ADD A
7E5D:  32 73 C1  STA $C173
7E60:  23        INX H
7E61:  7E        MOV A,M
7E62:  87        ADD A
7E63:  32 74 C1  STA $C174
7E66:  23        INX H
7E67:  E5        PUSH H
7E68:  C5        PUSH B
7E69:  CD 27 7E  CALL $7E27
7E6C:  CD D0 8C  CALL $8CD0
7E6F:  CD 27 7E  CALL $7E27
7E72:  C1        POP B
7E73:  E1        POP H
7E74:  0D        DCR C
7E75:  C2 5B 7E  JNZ $7E5B
7E78:  05        DCR B
7E79:  C2 4D 7E  JNZ $7E4D
7E7C:  C9        RET
7E7D:  21 00 C0  LXI H,$C000
7E80:  11 10 00  LXI D,$0010
7E83:  3E 30     MVI A,$30
7E85:  72        MOV M,D
7E86:  23        INX H
7E87:  3D        DCR A
7E88:  C2 85 7E  JNZ $7E85
7E8B:  CD 27 7E  CALL $7E27
7E8E:  19        DAD D
7E8F:  D2 83 7E  JNC $7E83
7E92:  C9        RET
7E93:  1A        LDAX D
7E94:  FE FF     CPI $FF
7E96:  C8        RZ
7E97:  6F        MOV L,A
7E98:  13        INX D
7E99:  1A        LDAX D
7E9A:  67        MOV H,A
7E9B:  13        INX D
7E9C:  22 3E C0  SHLD $C03E
7E9F:  1A        LDAX D
7EA0:  CD 27 7E  CALL $7E27
7EA3:  CD 00 85  CALL $8500
7EA6:  13        INX D
7EA7:  1A        LDAX D
7EA8:  FE 0D     CPI $0D
7EAA:  C2 9F 7E  JNZ $7E9F
7EAD:  13        INX D
7EAE:  C3 93 7E  JMP $7E93
7EB1:  10        -
7EB2:  E4 4C 4F  CPO $4F4C
7EB5:  52        MOV D,D
7EB6:  49        MOV C,C
7EB7:  4E        MOV C,M
7EB8:  4B        MOV C,E
7EB9:  41        MOV B,C
7EBA:  0D        DCR C
7EBB:  15        DCR D
7EBC:  E8        RPE
7EBD:  27        DAA
7EBE:  20        RIM
7EBF:  27        DAA
7EC0:  0D        DCR C
7EC1:  13        INX D
7EC2:  E9        PCHL
7EC3:  55        MOV D,L
7EC4:  56        MOV D,M
7EC5:  41        MOV B,C
7EC6:  44        MOV B,H
7EC7:  49        MOV C,C
7EC8:  3A 0D FF  LDA $FF0D
7ECB:  19        DAD D
7ECC:  FE 27     CPI $27
7ECE:  0D        DCR C
7ECF:  0F        RRC
7ED0:  FF        RST 7
7ED1:  43        MOV B,E
7ED2:  45        MOV B,L
7ED3:  4B        MOV C,E
7ED4:  45        MOV B,L
7ED5:  4A        MOV C,D
7ED6:  20        RIM
7ED7:  50        MOV D,B
7ED8:  52        MOV D,D
7ED9:  4F        MOV C,A
7EDA:  53        MOV D,E
7EDB:  49        MOV C,C
7EDC:  4D        MOV C,L
7EDD:  0D        DCR C
7EDE:  CF        RST 1
7EDF:  FC 4F 0D  CM $0D4F
7EE2:  0F        RRC
7EE3:  FC 20 0D  CM $0D20
7EE6:  FF        RST 7
7EE7:  09        DAD B
7EE8:  0D        DCR C
7EE9:  37        STC
7EEA:  1B        DCX D
7EEB:  3F        CMC
7EEC:  1A        LDAX D
7EED:  41        MOV B,C
7EEE:  20        RIM
7EEF:  0C        INR C
7EF0:  47        MOV B,A
7EF1:  24        INR H
7EF2:  1F        RAR
7EF3:  38        -
7EF4:  14        INR D
7EF5:  47        MOV B,A
7EF6:  10        -
7EF7:  50        MOV D,B
7EF8:  14        INR D
7EF9:  50        MOV D,B
7EFA:  18        -
7EFB:  4C        MOV C,H
7EFC:  18        -
7EFD:  45        MOV B,L
7EFE:  1F        RAR
7EFF:  45        MOV B,L
7F00:  21 47 22  LXI H,$2247
7F03:  4C        MOV C,H
7F04:  20        RIM
7F05:  04        INR B
7F06:  50        MOV D,B
7F07:  18        -
7F08:  51        MOV D,C
7F09:  1C        INR E
7F0A:  4D        MOV C,L
7F0B:  24        INR H
7F0C:  4C        MOV C,H
7F0D:  20        RIM
7F0E:  49        MOV C,C
7F0F:  1C        INR E
7F10:  04        INR B
7F11:  48        MOV C,B
7F12:  13        INX D
7F13:  4A        MOV C,D
7F14:  14        INR D
7F15:  48        MOV C,B
7F16:  15        DCR D
7F17:  46        MOV B,M
7F18:  14        INR D
7F19:  48        MOV C,B
7F1A:  13        INX D
7F1B:  02        STAX B
7F1C:  1E 3A     MVI E,$3A
7F1E:  12        STAX D
7F1F:  79        MOV A,C
7F20:  29        DAD H
7F21:  3B        DCX SP
7F22:  03        INX B
7F23:  26 42     MVI H,$42
7F25:  33        INX SP
7F26:  38        -
7F27:  41        MOV B,C
7F28:  23        INX H
7F29:  45        MOV B,L
7F2A:  21 07 6A  LXI H,$6A07
7F2D:  40        MOV B,B
7F2E:  39        DAD SP
7F2F:  34        INR M
7F30:  36 38     MVI M,$38
7F32:  37        STC
7F33:  3C        INR A
7F34:  33        INX SP
7F35:  39        DAD SP
7F36:  38        -
7F37:  31 3B 32  LXI SP,$323B
7F3A:  3E 35     MVI A,$35
7F3C:  01 0C 29  LXI B,$290C
7F3F:  1C        INR E
7F40:  2D        DCR L
7F41:  01 08 30  LXI B,$3008
7F44:  17        RAL
7F45:  34        INR M
7F46:  01 2F 3A  LXI B,$3A2F
7F49:  6D        MOV L,L
7F4A:  49        MOV C,C
7F4B:  01 04 2B  LXI B,$2B04
7F4E:  57        MOV D,A
7F4F:  7E        MOV A,M
7F50:  57        MOV D,A
7F51:  7E        MOV A,M
7F52:  76        HLT
7F53:  2B        DCX H
7F54:  76        HLT
7F55:  2B        DCX H
7F56:  57        MOV D,A
7F57:  12        STAX D
7F58:  02        STAX B
7F59:  30        SIM
7F5A:  59        MOV E,C
7F5B:  34        INR M
7F5C:  65        MOV H,L
7F5D:  3A 59 02  LDA $0259
7F60:  35        DCR M
7F61:  5E        MOV E,M
7F62:  38        -
7F63:  65        MOV H,L
7F64:  3E 59     MVI A,$59
7F66:  03        INX B
7F67:  3E 5F     MVI A,$5F
7F69:  40        MOV B,B
7F6A:  5E        MOV E,M
7F6B:  3E 65     MVI A,$65
7F6D:  40        MOV B,B
7F6E:  64        MOV H,H
7F6F:  01 41 5B  LXI B,$5B41
7F72:  42        MOV B,D
7F73:  5B        MOV E,E
7F74:  06 42     MVI B,$42
7F76:  65        MOV H,L
7F77:  48        MOV C,B
7F78:  59        MOV E,C
7F79:  45        MOV B,L
7F7A:  59        MOV E,C
7F7B:  46        MOV B,M
7F7C:  65        MOV H,L
7F7D:  4C        MOV C,H
7F7E:  59        MOV E,C
7F7F:  49        MOV C,C
7F80:  59        MOV E,C
7F81:  4A        MOV C,D
7F82:  65        MOV H,L
7F83:  01 4E 5E  LXI B,$5E4E
7F86:  4F        MOV C,A
7F87:  64        MOV H,H
7F88:  01 53 5E  LXI B,$5E53
7F8B:  4C        MOV C,H
7F8C:  6A        MOV L,D
7F8D:  02        STAX B
7F8E:  38        -
7F8F:  66        MOV H,M
7F90:  3D        DCR A
7F91:  73        MOV M,E
7F92:  43        MOV B,E
7F93:  67        MOV H,A
7F94:  02        STAX B
7F95:  3E 6C     MVI A,$6C
7F97:  41        MOV B,C
7F98:  73        MOV M,E
7F99:  47        MOV B,A
7F9A:  67        MOV H,A
7F9B:  04        INR B
7F9C:  4A        MOV C,D
7F9D:  6D        MOV L,L
7F9E:  46        MOV B,M
7F9F:  6F        MOV L,A
7FA0:  48        MOV C,B
7FA1:  73        MOV M,E
7FA2:  4C        MOV C,H
7FA3:  70        MOV M,B
7FA4:  4A        MOV C,D
7FA5:  6D        MOV L,L
7FA6:  01 4D 6D  LXI B,$6D4D
7FA9:  4B        MOV C,E
7FAA:  73        MOV M,E
7FAB:  03        INX B
7FAC:  4F        MOV C,A
7FAD:  73        MOV M,E
7FAE:  55        MOV D,L
7FAF:  65        MOV H,L
7FB0:  52        MOV D,D
7FB1:  65        MOV H,L
7FB2:  52        MOV D,D
7FB3:  73        MOV M,E
7FB4:  01 56 73  LXI B,$7356
7FB7:  59        MOV E,C
7FB8:  65        MOV H,L
7FB9:  02        STAX B
7FBA:  59        MOV E,C
7FBB:  73        MOV M,E
7FBC:  57        MOV D,A
7FBD:  70        MOV M,B
7FBE:  59        MOV E,C
7FBF:  6D        MOV L,L
7FC0:  04        INR B
7FC1:  5E        MOV E,M
7FC2:  73        MOV M,E
7FC3:  5B        MOV E,E
7FC4:  70        MOV M,B
7FC5:  5E        MOV E,M
7FC6:  6D        MOV L,L
7FC7:  60        MOV H,B
7FC8:  70        MOV M,B
7FC9:  5B        MOV E,E
7FCA:  70        MOV M,B
7FCB:  01 62 73  LXI B,$7362
7FCE:  64        MOV H,H
7FCF:  6D        MOV L,L
7FD0:  02        STAX B
7FD1:  63        MOV H,E
7FD2:  6F        MOV L,A
7FD3:  67        MOV H,A
7FD4:  6E        MOV L,M
7FD5:  69        MOV L,C
7FD6:  6F        MOV L,A
7FD7:  0F        RRC
7FD8:  6C        MOV L,H
7FD9:  63        MOV H,E
7FDA:  71        MOV M,C
7FDB:  5A        MOV E,D
7FDC:  76        HLT
7FDD:  5D        MOV E,L
7FDE:  62        MOV H,D
7FDF:  68        MOV L,B
7FE0:  67        MOV H,A
7FE1:  6B        MOV L,E
7FE2:  6C        MOV L,H
7FE3:  63        MOV H,E
7FE4:  7B        MOV A,E
7FE5:  60        MOV H,B
7FE6:  7B        MOV A,E
7FE7:  65        MOV H,L
7FE8:  5D        MOV E,L
7FE9:  60        MOV H,B
7FEA:  5D        MOV E,L
7FEB:  65        MOV H,L
7FEC:  6C        MOV L,H
7FED:  63        MOV H,E
7FEE:  76        HLT
7FEF:  68        MOV L,B
7FF0:  71        MOV M,C
7FF1:  6B        MOV L,E
7FF2:  67        MOV H,A
7FF3:  5A        MOV E,D
7FF4:  62        MOV H,D
7FF5:  5D        MOV E,L
7FF6:  6C        MOV L,H
7FF7:  63        MOV H,E
7FF8:  00        NOP
7FF9:  00        NOP
