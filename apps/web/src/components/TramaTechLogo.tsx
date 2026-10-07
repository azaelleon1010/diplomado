import React from 'react';
import { View, Text, StyleSheet } from 'react-native-web';

interface TramaTechLogoProps {
  collapsed?: boolean;
}

export function TramaTechLogo({ collapsed }: TramaTechLogoProps) {
  if (collapsed) {
    return (
      <View style={styles.iconOnly}>
        <Text style={styles.iconText}>TT</Text>
      </View>
    );
  }

  return (
    <View style={styles.full}>
      <View style={styles.hexagon}>
        <Text style={styles.iconText}>TT</Text>
      </View>
      <View>
        <Text style={styles.brand}>TramaTech</Text>
        <Text style={styles.slogan}>La red que mueve tu producción.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconOnly: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    color: '#0047AB',
    fontSize: 18,
    fontWeight: '700',
  },
  full: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hexagon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#0047AB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brand: {
    color: '#F1F5F9',
    fontSize: 16,
    fontWeight: '700',
  },
  slogan: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '400',
  },
});
